import { addDays } from "@/lib/dates";
import type { Scenario } from "@/features/big-purchase/types";
import { balanceLevel } from "@/features/calendar/engine/balanceThresholds";
import { scenarioEntries } from "@/features/calendar/engine/entries";
import { buildCalendarModel, type CalendarModel } from "@/features/calendar/engine/model";
import type { WeatherStage } from "@/features/calendar/engine/weatherStage";
import { ALL_ACCOUNTS, type Cents, type ISODate, type UserPurchase } from "@/features/calendar/types";

/**
 * Rescue plans for Storm Solver. Pure and deterministic: every number comes from re-running the
 * calendar forecast with trimmed everyday spending. Bills, income, and purchases are never moved,
 * and nothing is saved or sent anywhere.
 */

export type DayWeather = WeatherStage;
export type Tier = "gentle" | "balanced" | "aggressive";

/** Storm index weights per day (lower is better). */
export const WEATHER_WEIGHT: Record<DayWeather, number> = { sunny: 0, cloudy: 1, rainy: 3, downpour: 5 };
/** Typical bank overdraft fee, for the cost-of-inaction estimate only. Check your provider. */
export const TYPICAL_OVERDRAFT_FEE_CENTS = 3_500;
/** A day is out of the rain (cloudy or better) at the critical balance plus this, matching balanceLevel's bands. */
export const CLEAR_OF_RAIN_CENTS = 70_000;
/** A day is sunny at the critical balance plus this, matching balanceLevel's bands. */
export const SUNNY_CENTS = 120_000;
/** Non-sunny runs separated by this many sunny days or fewer are one storm. */
const MERGE_GAP_DAYS = 2;
const TRIM_LEVELS = [10, 20, 25, 30, 40] as const;

export interface TierSpec {
  tier: Tier;
  name: string;
  /** Highest trim on any one category, before the category's own limit. */
  maxTrimPercent: number;
  /** Most categories the plan may ask the user to trim. */
  maxCategories: number;
  goal: string;
}

export const TIERS: readonly TierSpec[] = [
  { tier: "gentle", name: "Gentle", maxTrimPercent: 10, maxCategories: 3, goal: "Keep every day out of the rain" },
  { tier: "balanced", name: "Balanced", maxTrimPercent: 25, maxCategories: 5, goal: "No rain, and half the cloudy days" },
  { tier: "aggressive", name: "Aggressive", maxTrimPercent: 40, maxCategories: 8, goal: "Sunny every day" },
];

/** The same mapping weatherStage uses, applied to one day's balance. */
export function dayWeather(balanceCents: Cents, criticalCents: Cents): DayWeather {
  const level = balanceLevel(balanceCents, criticalCents);
  if (level >= 4) return "downpour";
  if (level >= 2) return "rainy";
  if (level === 1) return "cloudy";
  return "sunny";
}

export interface DayOutlook { date: ISODate; cents: Cents; weather: DayWeather }

export interface StormMetrics {
  days: DayOutlook[];
  counts: Record<DayWeather, number>;
  stormDays: number;
  stormIndex: number;
  lowest: { date: ISODate; cents: Cents };
  /** Total cents below the sunny line across all days: partial credit when weather does not change. */
  gapCents: Cents;
  /** Days with money going out while the balance ends below $0. */
  overdraftDays: number;
}

/** Days after the as-of date through the forecast end; today has already posted. */
export function measure(model: CalendarModel, criticalCents: Cents): StormMetrics {
  const counts: Record<DayWeather, number> = { sunny: 0, cloudy: 0, rainy: 0, downpour: 0 };
  const days: DayOutlook[] = [];
  let lowest = { date: model.asOfDate, cents: Number.POSITIVE_INFINITY };
  let overdraftDays = 0;
  let gapCents = 0;
  for (const [date, { totalCents }] of model.balances) {
    if (date <= model.asOfDate) continue;
    const weather = dayWeather(totalCents, criticalCents);
    counts[weather] += 1;
    gapCents += Math.max(0, criticalCents + SUNNY_CENTS - totalCents);
    days.push({ date, cents: totalCents, weather });
    if (totalCents < lowest.cents) lowest = { date, cents: totalCents };
    const spends = (model.entriesByDate.get(date) ?? []).some((e) => e.kind !== "income" && e.kind !== "received" && e.kind !== "payment");
    if (totalCents < 0 && spends) overdraftDays += 1;
  }
  if (!Number.isFinite(lowest.cents)) lowest = { date: model.asOfDate, cents: model.startingCents };
  const stormIndex = days.reduce((sum, day) => sum + WEATHER_WEIGHT[day.weather], 0);
  return { days, counts, stormDays: days.length - counts.sunny, stormIndex, lowest, gapCents, overdraftDays };
}

export interface StormWindow { from: ISODate; to: ISODate; worst: Exclude<DayWeather, "sunny">; lowest: { date: ISODate; cents: Cents } }

export function stormWindows(days: readonly DayOutlook[]): StormWindow[] {
  const windows: StormWindow[] = [];
  let sunnyRun = 0;
  for (const day of days) {
    if (day.weather === "sunny") { sunnyRun += 1; continue; }
    const last = windows.at(-1);
    if (last && sunnyRun <= MERGE_GAP_DAYS && addDays(last.to, sunnyRun + 1) === day.date) {
      last.to = day.date;
      if (WEATHER_WEIGHT[day.weather] > WEATHER_WEIGHT[last.worst]) last.worst = day.weather;
      if (day.cents < last.lowest.cents) last.lowest = { date: day.date, cents: day.cents };
    } else {
      windows.push({ from: day.date, to: day.date, worst: day.weather, lowest: { date: day.date, cents: day.cents } });
    }
    sunnyRun = 0;
  }
  return windows;
}

export interface Trim { categoryId: string; label: string; percent: number; weeklyCents: Cents }

export interface RescuePlan {
  spec: TierSpec;
  trims: Trim[];
  metrics: StormMetrics;
  targetMet: boolean;
  /** Extra cash needed, and by when, to keep every day out of the rain after the trims; null if none. */
  cashNeeded: { cents: Cents; byDate: ISODate } | null;
}

export interface RescueInput {
  scenario: Scenario;
  purchases: readonly UserPurchase[];
  criticalCents: Cents;
  /** Category ids the user never wants trimmed. */
  protectedIds: ReadonlySet<string>;
}

export interface RescueResult {
  baseline: StormMetrics;
  storms: StormWindow[];
  costOfInactionCents: Cents;
  plans: RescuePlan[];
  /** Tiers whose plan matched a lower tier's, by name. */
  collapsed: string[];
}

export function trimmableCategories(scenario: Scenario) {
  return scenario.spending.filter((c) => c.cuttable && c.maxCutPercent > 0 && c.monthlyAmountCents > 0);
}

function simulate(input: RescueInput, cuts: Readonly<Record<string, number>>): StormMetrics {
  const scenario: Scenario = {
    ...input.scenario,
    spending: input.scenario.spending.map((c) => cuts[c.id] ? { ...c, monthlyAmountCents: Math.round((c.monthlyAmountCents * (100 - cuts[c.id])) / 100) } : c),
  };
  const model = buildCalendarModel(scenario, input.purchases, ALL_ACCOUNTS, scenarioEntries(scenario));
  return measure(model, input.criticalCents);
}

function meetsTarget(tier: Tier, metrics: StormMetrics, baseline: StormMetrics): boolean {
  const noRain = metrics.counts.rainy + metrics.counts.downpour === 0;
  if (tier === "gentle") return noRain;
  if (tier === "balanced") return noRain && metrics.counts.cloudy * 2 <= baseline.counts.cloudy;
  return metrics.stormDays === 0;
}

/** Lower storm index wins, then the smaller gap to sunny. */
function better(a: StormMetrics, b: StormMetrics): boolean {
  return a.stormIndex < b.stormIndex || (a.stormIndex === b.stormIndex && a.gapCents < b.gapCents);
}

function cashNeeded(metrics: StormMetrics, criticalCents: Cents): RescuePlan["cashNeeded"] {
  const target = criticalCents + CLEAR_OF_RAIN_CENTS;
  let worst = 0;
  let byDate: ISODate | null = null;
  for (const day of metrics.days) {
    if (day.cents >= target) continue;
    byDate ??= day.date;
    worst = Math.max(worst, target - day.cents);
  }
  return byDate ? { cents: Math.ceil(worst / 1_000) * 1_000, byDate } : null;
}

function buildPlan(input: RescueInput, spec: TierSpec, baseline: StormMetrics): RescuePlan {
  const categories = trimmableCategories(input.scenario)
    .filter((c) => !input.protectedIds.has(c.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const cuts: Record<string, number> = {};
  let current = baseline;

  // Greedy: raise one category to its next trim level at a time, keeping the best improvement.
  while (!meetsTarget(spec.tier, current, baseline)) {
    let best: { id: string; percent: number; metrics: StormMetrics } | null = null;
    for (const category of categories) {
      const active = Object.keys(cuts).length;
      if (!cuts[category.id] && active >= spec.maxCategories) continue;
      const cap = Math.min(spec.maxTrimPercent, category.maxCutPercent);
      const next = TRIM_LEVELS.find((level) => level > (cuts[category.id] ?? 0) && level <= cap);
      if (next === undefined) continue;
      const metrics = simulate(input, { ...cuts, [category.id]: next });
      if (better(metrics, best?.metrics ?? current)) best = { id: category.id, percent: next, metrics };
    }
    if (!best) break;
    cuts[best.id] = best.percent;
    current = best.metrics;
  }

  // Prune: drop any trim the plan still meets its target without.
  if (meetsTarget(spec.tier, current, baseline)) {
    for (const id of Object.keys(cuts).sort()) {
      const without = { ...cuts };
      delete without[id];
      const metrics = simulate(input, without);
      if (meetsTarget(spec.tier, metrics, baseline)) {
        delete cuts[id];
        current = metrics;
      }
    }
  }

  const trims = categories
    .filter((c) => cuts[c.id])
    .map((c) => ({ categoryId: c.id, label: c.label, percent: cuts[c.id], weeklyCents: Math.round((c.monthlyAmountCents * 12 * cuts[c.id]) / 5_200) }));
  return { spec, trims, metrics: current, targetMet: meetsTarget(spec.tier, current, baseline), cashNeeded: cashNeeded(current, input.criticalCents) };
}

const sameTrims = (a: RescuePlan, b: RescuePlan) =>
  a.trims.length === b.trims.length && a.trims.every((t, i) => t.categoryId === b.trims[i].categoryId && t.percent === b.trims[i].percent);

export function solveRescue(input: RescueInput): RescueResult {
  const baseline = simulate(input, {});
  const storms = stormWindows(baseline.days);
  const result: RescueResult = {
    baseline,
    storms,
    costOfInactionCents: baseline.overdraftDays * TYPICAL_OVERDRAFT_FEE_CENTS,
    plans: [],
    collapsed: [],
  };
  if (storms.length === 0) return result;
  for (const spec of TIERS) {
    const plan = buildPlan(input, spec, baseline);
    const previous = result.plans.at(-1);
    if (previous && sameTrims(previous, plan)) result.collapsed.push(spec.name);
    else result.plans.push(plan);
  }
  return result;
}

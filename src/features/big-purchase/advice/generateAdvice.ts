import { daysBetween, formatDate, ordinal } from "../../../lib/dates";
import { formatUSD, percentOfCents } from "../../../lib/money";
import { CATEGORY_CUT_STEP_PERCENT, DEFAULT_MAX_SHIFT_DAYS, MAX_ADVICE_ITEMS } from "../config";
import { projectBase } from "../engine/base";
import { requiredContribution } from "../engine/deadline";
import { maxCandidateCents, suggestedContribution, suggestedContributionCapCents } from "../engine/limits";
import { affordableDateFor, isAffordableNow } from "../engine/plan";
import type { AdviceItem, AdviceResult, Bill, Cents, Forecast, ISODate, Scenario, ScenarioMods } from "../types";
import type { ForecastGoal } from "../engine/forecast";

type Ease = AdviceItem["ease"];
const EASE_ORDER: Record<Ease, number> = { easy: 0, medium: 1, hard: 2 };

interface Outcome { date: ISODate | null; suggestedCents: Cents }

/**
 * Deterministic, advice-only suggestions. Every lever is tested by re-running the projection
 * on a modified copy, so each impact figure is exact. Nothing here changes the user's data.
 */
export function generateAdvice(scenario: Scenario, goal: ForecastGoal, forecast: Forecast, deadline: ISODate | null): AdviceResult {
  const current = forecast.plan.affordableDate;
  const gapDays = current && deadline ? daysBetween(deadline, current) : null;
  if (current && (deadline === null || current <= deadline)) return { onTrack: true, gapDays, items: [], combined: null };

  const planGoal = { costCents: goal.costCents, bufferCents: goal.bufferCents };
  const maxCents = maxCandidateCents(scenario, goal.costCents);
  const suggestedCapCents = suggestedContributionCapCents(scenario, goal.costCents);

  /** Affordable date with the contribution set to the new suggested amount (or a fixed amount). */
  const evaluate = (mods: ScenarioMods, fixedContribution?: Cents): Outcome => {
    const base = projectBase(scenario, mods);
    if (isAffordableNow(base.days, planGoal)) return { date: base.asOfDate, suggestedCents: 0 };
    const suggestedCents = suggestedContribution(base.days, base.paydays, planGoal, suggestedCapCents);
    return { date: affordableDateFor(base.paydays, goal.costCents, fixedContribution ?? suggestedCents), suggestedCents };
  };

  const items: AdviceItem[] = [];
  const add = (item: Omit<AdviceItem, "daysSooner" | "meetsDeadline">) => {
    const { newAffordableDate } = item;
    if (!newAffordableDate) return;
    const daysSooner = current ? daysBetween(newAffordableDate, current) : null;
    if (daysSooner !== null && daysSooner <= 0) return;
    items.push({ ...item, daysSooner, meetsDeadline: deadline !== null && newAffordableDate <= deadline });
  };
  const impact = (date: ISODate) => current
    ? `moves your date up ${daysBetween(date, current)} days`
    : `makes this affordable by ${formatDate(date, "full")}`;

  // Raise the contribution to the suggested amount, or to what the deadline needs (up to the limit).
  const inEffect = forecast.plan.contributionCents;
  const base = projectBase(scenario);
  const needed = deadline ? requiredContribution(base.days, base.paydays, planGoal, deadline, maxCents) : null;
  const deadlineNeeds = needed?.contributionCents ?? (deadline ? forecast.limitContributionCents : 0);
  const target = Math.max(forecast.suggestedContributionCents, Math.min(deadlineNeeds, forecast.limitContributionCents));
  if (target > inEffect) {
    const date = affordableDateFor(base.paydays, goal.costCents, target);
    const aboveSuggested = target > forecast.suggestedContributionCents;
    // The suggestion is also capped at 20% of a paycheck, so going above it doesn't by itself break the buffer.
    const bufferSafeCents = suggestedContribution(base.days, base.paydays, planGoal, maxCents);
    const buffer = formatUSD(goal.bufferCents);
    if (date) {
      add({
        id: "raise-contribution",
        type: "raise-contribution",
        title: `Set aside ${formatUSD(target)} per paycheck`,
        reason: target > bufferSafeCents
          ? `Setting aside ${formatUSD(target)} per paycheck ${impact(date)}. That is above ${formatUSD(bufferSafeCents)}, the most that keeps cash above your ${buffer} buffer, so cash would dip under it on some days.`
          : aboveSuggested
            ? `Setting aside ${formatUSD(target)} per paycheck ${impact(date)} while keeping cash above your ${buffer} buffer. That is above the suggested amount of ${formatUSD(forecast.suggestedContributionCents)}, which is capped at 20% of your paycheck.`
            : `Your safe suggested amount is ${formatUSD(forecast.suggestedContributionCents)} per paycheck and you are using ${formatUSD(inEffect)}. Raising it ${impact(date)} while keeping cash above your buffer.`,
        newAffordableDate: date,
        ease: byThreshold(target - inEffect, 5_000, 15_000),
        params: { newContributionCents: target, previousContributionCents: inEffect, aboveSuggested: aboveSuggested ? 1 : 0 },
      });
    }
  }

  // Shift a monthly bill's due day within its allowed range; keep the best result.
  for (const bill of scenario.bills) {
    if (!bill.shiftable || bill.schedule.frequency !== "monthly" || bill.schedule.dayOfMonth === undefined) continue;
    const from = bill.schedule.dayOfMonth;
    const range = bill.maxShiftDays ?? DEFAULT_MAX_SHIFT_DAYS;
    let best: { day: number; outcome: Outcome } | null = null;
    for (let day = Math.max(1, from - range); day <= Math.min(31, from + range); day++) {
      if (day === from) continue;
      const outcome = evaluate({ billDueDays: { [bill.id]: day } });
      if (outcome.date && (!best || !best.outcome.date || outcome.date < best.outcome.date
        || (outcome.date === best.outcome.date && Math.abs(day - from) < Math.abs(best.day - from)))) {
        best = { day, outcome };
      }
    }
    if (!best?.outcome.date) continue;
    const extra = Math.max(0, best.outcome.suggestedCents - forecast.suggestedContributionCents);
    add({
      id: `shift-bill:${bill.id}`,
      type: "shift-bill",
      title: `Move ${bill.label} to the ${ordinal(best.day)}`,
      reason: `Moving ${bill.label} from the ${ordinal(from)} to the ${ordinal(best.day)} keeps more cash on hand right before payday, which lets you set aside ${formatUSD(extra)} more per paycheck.`,
      newAffordableDate: best.outcome.date,
      ease: "easy",
      params: { billId: bill.id, fromDay: from, newDay: best.day, newContributionCents: best.outcome.suggestedCents },
    });
  }

  // Cancel a recurring bill.
  for (const bill of scenario.bills) {
    if (!bill.cancellable) continue;
    const outcome = evaluate({ removedBillIds: [bill.id] });
    const monthly = monthlyCostCents(bill);
    add({
      id: `cut-recurring:${bill.id}`,
      type: "cut-recurring",
      title: `Cancel ${bill.label}`,
      reason: `${bill.label} costs ${formatUSD(monthly)} a month. Cancelling it frees that money for this goal.`,
      newAffordableDate: outcome.date,
      ease: monthly < 2_500 ? "easy" : monthly < 7_500 ? "medium" : "hard",
      params: { billId: bill.id, monthlyCents: monthly, newContributionCents: outcome.suggestedCents },
    });
  }

  // Trim a spending category: the smallest cut that meets the deadline, else the largest allowed.
  for (const category of scenario.spending) {
    if (!category.cuttable || category.maxCutPercent <= 0) continue;
    const levels: number[] = [];
    for (let p = CATEGORY_CUT_STEP_PERCENT; p < category.maxCutPercent; p += CATEGORY_CUT_STEP_PERCENT) levels.push(p);
    levels.push(category.maxCutPercent);
    let chosen: { percent: number; outcome: Outcome } | null = null;
    for (const percent of levels) {
      const outcome = evaluate({ categoryCutPercents: { [category.id]: percent } });
      chosen = { percent, outcome };
      if (deadline && outcome.date && outcome.date <= deadline) break;
    }
    if (!chosen) continue;
    const freed = percentOfCents(category.monthlyAmountCents, chosen.percent);
    add({
      id: `trim-category:${category.id}`,
      type: "trim-category",
      title: `Trim ${category.label} by ${chosen.percent}%`,
      reason: `You spend about ${formatUSD(category.monthlyAmountCents)} a month on ${category.label.toLowerCase()}. Trimming ${chosen.percent}% frees ${formatUSD(freed)} a month.`,
      newAffordableDate: chosen.outcome.date,
      ease: chosen.percent <= 10 ? "easy" : chosen.percent <= 20 ? "medium" : "hard",
      params: { categoryId: category.id, cutPercent: chosen.percent, monthlyFreedCents: freed, newContributionCents: chosen.outcome.suggestedCents },
    });
  }

  const ranked = items.sort(compareItems).slice(0, MAX_ADVICE_ITEMS);
  return { onTrack: false, gapDays, items: ranked, combined: combine(ranked, evaluate, deadline) };
}

function compareItems(a: AdviceItem, b: AdviceItem): number {
  if (a.daysSooner !== b.daysSooner) {
    if (a.daysSooner !== null && b.daysSooner !== null) return b.daysSooner - a.daysSooner;
  }
  if (a.daysSooner === null && b.daysSooner === null && a.newAffordableDate !== b.newAffordableDate) {
    return (a.newAffordableDate ?? "9999") < (b.newAffordableDate ?? "9999") ? -1 : 1;
  }
  return EASE_ORDER[a.ease] - EASE_ORDER[b.ease] || a.title.localeCompare(b.title);
}

/** Applies ranked items one at a time, re-testing after each, until the deadline is met. */
function combine(items: AdviceItem[], evaluate: (mods: ScenarioMods, fixed?: Cents) => Outcome, deadline: ISODate | null): AdviceResult["combined"] {
  if (!items.length) return null;
  const mods: Required<ScenarioMods> = { removedBillIds: [], billDueDays: {}, categoryCutPercents: {} };
  let raiseTo: Cents | null = null;
  const itemIds: string[] = [];
  let earliestDate: ISODate | null = null;
  for (const item of items) {
    const p = item.params;
    if (item.type === "raise-contribution") raiseTo = Number(p.newContributionCents);
    if (item.type === "shift-bill") mods.billDueDays[String(p.billId)] = Number(p.newDay);
    if (item.type === "cut-recurring") mods.removedBillIds.push(String(p.billId));
    if (item.type === "trim-category") mods.categoryCutPercents[String(p.categoryId)] = Number(p.cutPercent);
    itemIds.push(item.id);
    const suggested = evaluate(mods);
    earliestDate = raiseTo !== null && raiseTo > suggested.suggestedCents ? evaluate(mods, raiseTo).date : suggested.date;
    if (deadline && earliestDate && earliestDate <= deadline) return { itemIds, reachesDeadline: true, earliestDate };
  }
  return { itemIds, reachesDeadline: false, earliestDate };
}

function byThreshold(cents: Cents, easyMax: Cents, mediumMax: Cents): Ease {
  return cents <= easyMax ? "easy" : cents <= mediumMax ? "medium" : "hard";
}

export function monthlyCostCents(bill: Bill): Cents {
  switch (bill.schedule.frequency) {
    case "weekly": return Math.round((bill.amountCents * 52) / 12);
    case "biweekly": return Math.round((bill.amountCents * 26) / 12);
    case "semimonthly": return bill.amountCents * 2;
    case "yearly": return Math.round(bill.amountCents / 12);
    default: return bill.amountCents;
  }
}

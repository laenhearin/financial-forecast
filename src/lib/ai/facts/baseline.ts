import { addDays } from "@/lib/dates";
import type { Scenario } from "@/features/big-purchase/types";
import { BALANCE_LABELS, balanceLevel, type BalanceLevel } from "@/features/calendar/engine/balanceThresholds";
import { scenarioEntries } from "@/features/calendar/engine/entries";
import { buildCalendarModel } from "@/features/calendar/engine/model";
import { ALL_ACCOUNTS, type CalendarEntry, type UserPurchase } from "@/features/calendar/types";
import type { Baseline, Cents } from "../types";

export const BASELINE_DAYS = 14;
const MAX_UPCOMING = 24;
const MAX_WORST_DAYS = 5;

/**
 * Compact summary the ask box sends with every question: the next two weeks of end-of-day balances
 * and levels, scheduled items, and the low point. All values come from the calendar engine.
 */
export function buildBaseline(
  scenario: Scenario,
  purchases: readonly UserPurchase[],
  criticalCents: Cents,
  entries: readonly CalendarEntry[] = scenarioEntries(scenario),
): Baseline {
  const model = buildCalendarModel(scenario, purchases, ALL_ACCOUNTS, entries);
  const today = scenario.asOfDate;
  const last = addDays(today, BASELINE_DAYS);

  const days: Array<{ date: string; level: BalanceLevel; endBalanceCents: Cents }> = [];
  for (let date = addDays(today, 1); date <= last; date = addDays(date, 1)) {
    const cents = model.balances.get(date)?.totalCents;
    if (cents !== undefined) days.push({ date, level: balanceLevel(cents, criticalCents), endBalanceCents: cents });
  }
  const low = days.reduce<(typeof days)[number] | null>((lowest, day) => (!lowest || day.endBalanceCents < lowest.endBalanceCents ? day : lowest), null);
  const worstLevel = Math.max(...days.map((day) => day.level));
  const worstDays = worstLevel >= 2 ? days.filter((day) => day.level === worstLevel).slice(0, MAX_WORST_DAYS).map((day) => day.date) : [];
  const currentBalanceCents = model.balances.get(today)?.totalCents ?? model.startingCents;

  return {
    today,
    currentBalanceCents,
    criticalBalanceCents: criticalCents,
    horizonDays: BASELINE_DAYS,
    days: days.map((day) => ({ date: day.date, level: BALANCE_LABELS[day.level], endBalanceCents: day.endBalanceCents })),
    upcoming: model.entries
      .filter((entry) => entry.date > today && entry.date <= last && entry.kind !== "estimate")
      .slice(0, MAX_UPCOMING)
      .map((entry) => ({ date: entry.date, label: entry.label, amountCents: entry.amountCents, kind: entry.kind as Exclude<CalendarEntry["kind"], "estimate"> })),
    lowestBalance: low
      ? { date: low.date, cents: low.endBalanceCents, level: BALANCE_LABELS[low.level] }
      : { date: today, cents: currentBalanceCents, level: BALANCE_LABELS[balanceLevel(currentBalanceCents, criticalCents)] },
    worstDays,
  };
}

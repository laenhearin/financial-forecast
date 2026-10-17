import type { Scenario } from "@/features/big-purchase/types";
import { BALANCE_LABELS } from "@/features/calendar/engine/balanceThresholds";
import { scenarioEntries } from "@/features/calendar/engine/entries";
import { checkPurchase, earliestSaferDate, purchaseRecommendation, worsenedDays } from "@/features/calendar/engine/purchaseCheck";
import type { CalendarEntry, UserPurchase } from "@/features/calendar/types";
import type { AdvisorFacts, Cents, PurchaseInput } from "../types";

/** Worsened days listed by date; the total count is always included. */
const MAX_LISTED_DAYS = 6;

/**
 * Facts for one purchase, all from the calendar engine. Used by the Advisor explanation and by the
 * ask box's checkPurchase tool. The model only words these; it never recomputes them.
 */
export function buildAdvisorFacts(
  scenario: Scenario,
  purchases: readonly UserPurchase[],
  purchase: PurchaseInput,
  criticalCents: Cents,
  entries: readonly CalendarEntry[] = scenarioEntries(scenario),
): AdvisorFacts {
  const check = checkPurchase(scenario, purchases, purchase, criticalCents, entries);
  const worse = worsenedDays(check);
  const paycheck = check.baseline.entries.find((entry) => entry.kind === "income" && entry.date >= purchase.date && entry.date > scenario.asOfDate);
  return {
    purchase: { label: purchase.label, amountCents: purchase.amountCents, date: purchase.date },
    level: check.level,
    levelLabel: BALANCE_LABELS[check.level],
    recommendation: purchaseRecommendation(check).title,
    criticalBalanceCents: criticalCents,
    startingBalanceCents: check.baseline.startingCents,
    lowestWithPurchase: { date: check.lowestWith.date, cents: check.lowestWith.cents },
    lowestWithoutPurchase: { date: check.lowestWithout.date, cents: check.lowestWithout.cents },
    worsenedDays: worse.slice(0, MAX_LISTED_DAYS).map((day) => ({ date: day.date, from: BALANCE_LABELS[day.from], to: BALANCE_LABELS[day.to] })),
    worsenedDayCount: worse.length,
    nextPaycheck: paycheck ? { date: paycheck.date, amountCents: paycheck.amountCents } : null,
    earliestSaferDate: check.level >= 3 ? earliestSaferDate(scenario, purchases, purchase, criticalCents, entries) : null,
    forecastEnd: check.preview.forecastEnd,
  };
}

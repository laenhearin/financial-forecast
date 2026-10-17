import { addDays, formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import type { Scenario } from "@/features/big-purchase/types";
import { ALL_ACCOUNTS, type CalendarEntry, type Cents, type ISODate, type UserPurchase } from "../types";
import { balanceLevel, type BalanceLevel } from "./balanceThresholds";
import { scenarioEntries } from "./entries";
import { buildCalendarModel, lowestBalanceFrom, type CalendarModel } from "./model";

/** The hypothetical purchase's id; it never collides with saved purchases. */
export const HYPOTHETICAL_PURCHASE_ID = "hypothetical-purchase";

export interface PurchaseCheck {
  purchase: UserPurchase;
  criticalCents: Cents;
  baseline: CalendarModel;
  preview: CalendarModel;
  /** Lowest balance on or after the purchase date, without and with the purchase. */
  lowestWithout: { date: ISODate; cents: Cents };
  lowestWith: { date: ISODate; cents: Cents };
  /** The verdict: balance level of the lowest point after the purchase. */
  level: BalanceLevel;
}

/**
 * Evaluates a one-time purchase against the calendar forecast (all accounts, plus purchases the
 * user already added). The Purchase Advisor page and the ask box's checkPurchase tool both use
 * this, so they always agree.
 */
export function checkPurchase(
  scenario: Scenario,
  purchases: readonly UserPurchase[],
  purchase: Omit<UserPurchase, "id">,
  criticalCents: Cents,
  entries: readonly CalendarEntry[] = scenarioEntries(scenario),
  baseline: CalendarModel = buildCalendarModel(scenario, purchases, ALL_ACCOUNTS, entries),
): PurchaseCheck {
  const hypothetical: UserPurchase = { ...purchase, id: HYPOTHETICAL_PURCHASE_ID };
  const preview = buildCalendarModel(scenario, [...purchases, hypothetical], ALL_ACCOUNTS, entries);
  const lowestWith = lowestBalanceFrom(preview, purchase.date);
  return {
    purchase: hypothetical,
    criticalCents,
    baseline,
    preview,
    lowestWithout: lowestBalanceFrom(baseline, purchase.date),
    lowestWith,
    level: balanceLevel(lowestWith.cents, criticalCents),
  };
}

export interface PurchaseRecommendation { title: string; detail: string }

/** The Advisor's recommendation text for a check. */
export function purchaseRecommendation({ level, lowestWith, criticalCents }: PurchaseCheck): PurchaseRecommendation {
  if (level === 5) return {
    title: "Not recommended for this date",
    detail: `The forecast falls below $0, reaching ${formatUSD(lowestWith.cents)} on ${formatDate(lowestWith.date, "short")}. Consider waiting, choosing a cheaper option, or changing the date.`,
  };
  if (level === 4) return {
    title: "I’d wait or lower the cost",
    detail: `After this purchase, the forecast reaches ${formatUSD(lowestWith.cents)} on ${formatDate(lowestWith.date, "short")}—at or below your ${formatUSD(criticalCents)} critical threshold.`,
  };
  if (level === 3) return {
    title: "This looks risky",
    detail: `The lowest projected balance is only $200 or less above your critical threshold. Delaying the purchase or reducing its cost would leave more room for bills and unexpected expenses.`,
  };
  if (level === 2) return {
    title: "Possible, with a tighter buffer",
    detail: `The forecast stays above critical, but the lowest balance is less than $700 above your threshold. Consider whether the purchase can wait or cost less.`,
  };
  return {
    title: level === 0 ? "Looks manageable in this forecast" : "The forecast keeps some room",
    detail: `The lowest projected balance after the purchase is ${formatUSD(lowestWith.cents)} on ${formatDate(lowestWith.date, "short")}, above your ${formatUSD(criticalCents)} critical threshold.`,
  };
}

/** Days from the purchase date whose balance level gets worse with the purchase. */
export function worsenedDays(check: PurchaseCheck): Array<{ date: ISODate; from: BalanceLevel; to: BalanceLevel }> {
  const out: Array<{ date: ISODate; from: BalanceLevel; to: BalanceLevel }> = [];
  for (let date = check.purchase.date; date <= check.preview.forecastEnd; date = addDays(date, 1)) {
    const from = balanceLevel(check.baseline.balances.get(date)?.totalCents ?? null, check.criticalCents);
    const to = balanceLevel(check.preview.balances.get(date)?.totalCents ?? null, check.criticalCents);
    if (to > from) out.push({ date, from, to });
  }
  return out;
}

/**
 * First date after the purchase date where buying keeps the verdict at `maxLevel` or better
 * (CAUTION by default), within the forecast window. Null when none.
 */
export function earliestSaferDate(
  scenario: Scenario,
  purchases: readonly UserPurchase[],
  purchase: Omit<UserPurchase, "id">,
  criticalCents: Cents,
  entries: readonly CalendarEntry[] = scenarioEntries(scenario),
  maxLevel: BalanceLevel = 2,
): ISODate | null {
  const baseline = buildCalendarModel(scenario, purchases, ALL_ACCOUNTS, entries);
  for (let date = addDays(purchase.date, 1); date <= baseline.forecastEnd; date = addDays(date, 1)) {
    if (checkPurchase(scenario, purchases, { ...purchase, date }, criticalCents, entries, baseline).level <= maxLevel) return date;
  }
  return null;
}

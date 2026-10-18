import { addDays, dateParts, maxDate } from "../../../lib/dates";
import { buildEvents } from "../../big-purchase/engine/events";
import { occurrences } from "../../big-purchase/engine/schedule";
import type { Bill, Scenario } from "../../big-purchase/types";
import { ESSENTIAL_CATEGORIES, FORECAST_DAYS } from "../config";
import type { BillPriority, CalendarEntry, ISODate, UserPurchase } from "../types";

/** Optional if it can be cancelled; essential for housing and utilities; otherwise important. */
export function billPriority(bill: Pick<Bill, "category" | "cancellable">): BillPriority {
  if (bill.cancellable) return "optional";
  return ESSENTIAL_CATEGORIES.includes(bill.category) ? "essential" : "important";
}

/** Scheduled items post to the first account counted in the forecast (the paycheck account). */
export function primaryAccountId(scenario: Scenario): string {
  return (scenario.accounts.find((account) => account.includeInForecast) ?? scenario.accounts[0])?.id ?? "";
}

export function forecastEndDate(asOfDate: ISODate): ISODate {
  return addDays(asOfDate, FORECAST_DAYS);
}

const KIND_ORDER: Record<CalendarEntry["kind"], number> = { income: 0, received: 1, bill: 2, planned: 3, purchase: 4, payment: 5, estimate: 6 };

/** By date, then income first within a day. */
export function sortEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : KIND_ORDER[a.kind] - KIND_ORDER[b.kind]));
}

/**
 * Calendar entries from the scenario for the days after the as-of date through the forecast
 * window. Uses the forecast engine's events, so balances match Big purchase. Weekly spending
 * estimates are folded into one entry per day.
 */
export function scenarioEntries(scenario: Scenario): CalendarEntry[] {
  const end = forecastEndDate(scenario.asOfDate);
  const accountId = primaryAccountId(scenario);
  const bills = new Map(scenario.bills.map((bill) => [bill.id, bill]));
  const estimates = new Map<ISODate, { cents: number; labels: string[] }>();
  const entries: CalendarEntry[] = [];

  for (const event of buildEvents(scenario)) {
    if (event.date > end) continue;
    const base = { sourceId: event.sourceId, date: event.date, label: event.label, amountCents: Math.abs(event.deltaCents), accountId };
    switch (event.kind) {
      case "income":
        entries.push({ ...base, id: `${event.sourceId}-${event.date}`, kind: "income", recurring: true });
        break;
      case "bill": {
        const bill = bills.get(event.sourceId);
        entries.push({ ...base, id: `${event.sourceId}-${event.date}`, kind: "bill", recurring: true, priority: bill ? billPriority(bill) : "important" });
        break;
      }
      case "one-off":
        entries.push({ ...base, id: `${event.sourceId}-${event.date}`, kind: event.deltaCents > 0 ? "income" : "planned", recurring: false });
        break;
      case "spending": {
        const day = estimates.get(event.date) ?? { cents: 0, labels: [] };
        day.cents += Math.abs(event.deltaCents);
        day.labels.push(event.label);
        estimates.set(event.date, day);
        break;
      }
    }
  }

  for (const [date, { cents, labels }] of estimates) {
    entries.push({
      id: `estimate-${date}`,
      sourceId: "everyday-spending",
      date,
      kind: "estimate",
      label: "Everyday spending (estimate)",
      amountCents: cents,
      accountId,
      recurring: true,
      detail: labels.join(", "),
    });
  }
  return sortEntries(entries);
}

export function purchaseEntry(purchase: UserPurchase): CalendarEntry {
  return {
    id: purchase.id,
    sourceId: purchase.id,
    date: purchase.date,
    kind: "purchase",
    label: purchase.label,
    amountCents: purchase.amountCents,
    accountId: purchase.accountId,
    recurring: purchase.recurring ?? false,
  };
}

/** Expands a monthly user purchase into dated forecast entries. */
export function purchaseEntries(purchase: UserPurchase, fromDate: ISODate, toDate: ISODate): CalendarEntry[] {
  if (!purchase.recurring) return [purchaseEntry(purchase)];
  const dayOfMonth = dateParts(purchase.date).day;
  const dates = occurrences({ frequency: "monthly", dayOfMonth }, maxDate(purchase.date, fromDate), toDate);
  const skipped = new Set(purchase.skippedDates ?? []);
  return dates
    .filter((date) => (!purchase.cancelFromDate || date < purchase.cancelFromDate) && !skipped.has(date))
    .map((date) => ({ ...purchaseEntry({ ...purchase, id: `${purchase.id}:${date}`, date }), sourceId: purchase.id }));
}

/** Money coming in: scheduled income or a recorded deposit. */
export function isIncoming(entry: Pick<CalendarEntry, "kind">): boolean {
  return entry.kind === "income" || entry.kind === "received";
}

/** Recorded Nessie transactions, already included in the balance snapshot. */
export function isRecorded(entry: Pick<CalendarEntry, "kind">): boolean {
  return entry.kind === "payment" || entry.kind === "received";
}

/** Signed change to the balance. */
export function signedCents(entry: Pick<CalendarEntry, "kind" | "amountCents">): number {
  return isIncoming(entry) ? entry.amountCents : -entry.amountCents;
}

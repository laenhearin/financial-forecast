import type { Scenario } from "@/features/big-purchase/types";
import { addDays } from "@/lib/dates";
import type { CalendarEntry, Cents, ISODate } from "../types";

export type BalanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const BALANCE_LABELS: Record<BalanceLevel, string> = {
  0: "THRIVING",
  1: "STABLE",
  2: "CAUTION",
  3: "NEAR CRITICAL",
  4: "CRITICAL",
  5: "BELOW $0",
};

/** Defaults the critical threshold to the scenario's rent or housing bill. */
export function defaultCriticalBalanceCents(scenario: Scenario): Cents {
  const housing = scenario.bills.filter((bill) => bill.category.toLowerCase() === "housing");
  const rent = housing.find((bill) => /rent/i.test(bill.label)) ?? housing[0];
  return rent?.amountCents ?? 0;
}

/** Severity bands: rent, then rent + $200, +$700, and +$1,200. */
export function balanceLevel(balanceCents: Cents | null, criticalCents: Cents): BalanceLevel {
  if (balanceCents === null) return 0;
  if (balanceCents < 0) return 5;
  if (balanceCents <= criticalCents) return 4;
  if (balanceCents < criticalCents + 20_000) return 3;
  if (balanceCents < criticalCents + 70_000) return 2;
  if (balanceCents < criticalCents + 120_000) return 1;
  return 0;
}

/** Identifies major scheduled bills such as housing, vehicle payments, or bills of $500+. */
export function isMajorBill(entry: Pick<CalendarEntry, "kind" | "label" | "amountCents">): boolean {
  return entry.kind === "bill" && (entry.amountCents >= 50_000 || /rent|housing|mortgage|car payment|auto loan|vehicle payment/i.test(entry.label));
}

export function majorBillWithinWeek(entries: readonly CalendarEntry[], fromDate: ISODate): CalendarEntry | null {
  const throughDate = addDays(fromDate, 7);
  return entries.find((entry) => isMajorBill(entry) && entry.date >= fromDate && entry.date <= throughDate) ?? null;
}

/** Finds a major bill due within seven days whose post-bill balance is caution or worse. */
export function majorBillImpact(
  entries: readonly CalendarEntry[],
  fromDate: ISODate,
  criticalCents: Cents,
  balanceOnDate: (date: ISODate) => Cents | null,
): { entry: CalendarEntry; level: BalanceLevel; balanceCents: Cents } | null {
  const throughDate = addDays(fromDate, 7);
  for (const entry of entries) {
    if (!isMajorBill(entry) || entry.date < fromDate || entry.date > throughDate) continue;
    const balanceCents = balanceOnDate(entry.date);
    const level = balanceLevel(balanceCents, criticalCents);
    if (level >= 2 && balanceCents !== null) return { entry, level, balanceCents };
  }
  return null;
}

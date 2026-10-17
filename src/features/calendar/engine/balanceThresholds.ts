import type { Scenario } from "@/features/big-purchase/types";
import type { Cents } from "../types";

export type BalanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const BALANCE_LABELS: Record<BalanceLevel, string> = {
  0: "Great",
  1: "Okay",
  2: "Above critical",
  3: "Near critical",
  4: "Critical",
  5: "Below $0",
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

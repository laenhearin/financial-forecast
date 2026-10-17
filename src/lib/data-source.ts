import type { Scenario } from "../features/big-purchase/types";
import { formatDate } from "./dates";

/** One wording for every page: whose Nessie data this is, and that the sandbox is mock bank data. */
export function nessieSourceNote(customerName: string, asOfDate: string): string {
  return `Nessie sandbox data for ${customerName}, as of ${formatDate(asOfDate, "full")}. Mock bank data, not a real bank connection.`;
}

/** Swipe and Shine adds this: where the monthly category spending came from. */
export function cashBackSpendNote(scenario: Pick<Scenario, "income">): string {
  return scenario.income.some(income => income.id === "plan-income")
    ? "Monthly spending by category is this customer's plan budget; cards start from their Nessie credit card accounts."
    : "Monthly spending averages the last 90 days of Nessie withdrawals; cards start from the customer's Nessie credit card accounts.";
}

/** Forecast pages add this. Nessie has no income or spending schedule, so says where both came from. */
export function forecastEstimateNote(scenario: Pick<Scenario, "income">): string {
  // Kept in sync with PLAN_INCOME_ID in nessie-profile.ts, which is server-only.
  return scenario.income.some(income => income.id === "plan-income")
    ? "Income and everyday spending are this customer's plan assumptions; balances, bills, and loans come from Nessie."
    : "Income repeats the latest Nessie deposit monthly; everyday spending averages the last 90 days of withdrawals.";
}

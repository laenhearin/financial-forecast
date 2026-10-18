import type { Scenario } from "../features/big-purchase/types";
import { formatDate } from "./dates";

/** One wording for every page: whose Nessie data this is, and that the sandbox is mock bank data. */
export function nessieSourceNote(customerName: string, asOfDate: string): string {
  return `Nessie sandbox data for ${customerName}, as of ${formatDate(asOfDate, "full")}. Mock bank data, not a real bank connection.`;
}

/** Swipe and Shine adds this: where the monthly category spending came from. */
export function cashBackSpendNote(): string {
  return "Monthly spending by category averages the last 6 months of Nessie transactions; cards start from the customer's Nessie credit card accounts.";
}

/** Forecast pages add this. Nessie has no income schedule, so says where income and spending came from. */
export function forecastEstimateNote(scenario: Pick<Scenario, "income">): string {
  // Kept in sync with PLAN_INCOME_ID in nessie-profile.ts, which is server-only.
  return scenario.income.some(income => income.id === "plan-income")
    ? "Income is this customer's plan paycheck; spending by category averages the last 6 months of Nessie transactions; balances, bills, and loans come from Nessie."
    : "Income repeats the latest Nessie deposit monthly; spending by category averages the last 6 months of Nessie transactions.";
}

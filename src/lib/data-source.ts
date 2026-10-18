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

/**
 * Forecast pages add this. Nessie has no income schedule, so says where income and spending came
 * from, how much history the spending rests on, and what the daily balances do and do not model.
 */
export function forecastEstimateNote(scenario: Pick<Scenario, "income" | "spendingCoverage">): string {
  // Kept in sync with PLAN_INCOME_ID in nessie-profile.ts, which is server-only.
  const income = scenario.income.some(source => source.id === "plan-income")
    ? "Income is this customer's plan paycheck; spending by category averages the last 6 months of Nessie transactions; balances, bills, and loans come from Nessie."
    : "Income is estimated from Nessie deposits that repeat on a regular schedule (or one recent paycheck-like deposit when none repeat); spending by category averages the last 6 months of Nessie transactions.";
  return [income, coverageNote(scenario.spendingCoverage), FORECAST_TIMING_NOTE].filter(Boolean).join(" ");
}

/** What the daily numbers are: end-of-day totals, with everyday spending as a weekly allowance. */
export const FORECAST_TIMING_NOTE =
  "Balances are estimated end-of-day totals; the order payments post within a day can differ. Everyday spending is a weekly estimate shown on Saturdays, not a prediction of individual purchases.";

function coverageNote(coverage: Scenario["spendingCoverage"]): string {
  if (!coverage) return "";
  const basis = `${coverage.months.toFixed(1)} months, ${coverage.spendRecords} spending ${coverage.spendRecords === 1 ? "record" : "records"}`;
  if (coverage.level === "established") return `Spending history: established (${basis}).`;
  if (coverage.level === "limited") return `Spending history: limited (${basis}); estimates may be off.`;
  return `Spending history: too thin for a reliable estimate (${basis}); missing records can make spending look lower than it is.`;
}

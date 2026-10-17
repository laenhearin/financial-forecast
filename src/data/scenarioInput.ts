import { dollarsToCents } from "../lib/money";
import type { Scenario, Schedule } from "../features/big-purchase/types";

/** Demo scenarios are authored in dollars for easy editing; normalizeScenario converts them to cents once. */
export interface ScenarioInput {
  label: string;
  customerName: string;
  /** The demo's "today", YYYY-MM-DD. */
  asOfDate: string;
  accounts: { id: string; nickname: string; type: "checking" | "savings"; balance: number; includeInForecast: boolean }[];
  income: { id: string; label: string; amount: number; schedule: Schedule; isPaycheck: boolean }[];
  bills: {
    id: string; label: string; amount: number; schedule: Schedule; category: string;
    cancellable: boolean; shiftable: boolean; maxShiftDays?: number;
  }[];
  spending: { id: string; label: string; monthlyAmount: number; cuttable: boolean; maxCutPercent: number }[];
  /** Positive amounts; `type` gives the direction. */
  oneOffs: { id: string; label: string; date: string; amount: number; type: "income" | "expense" }[];
}

export function normalizeScenario(id: string, input: ScenarioInput): Scenario {
  return {
    id,
    label: input.label,
    customerName: input.customerName,
    asOfDate: input.asOfDate,
    accounts: input.accounts.map(({ balance, ...rest }) => ({ ...rest, balanceCents: dollarsToCents(balance) })),
    income: input.income.map(({ amount, ...rest }) => ({ ...rest, amountCents: dollarsToCents(amount) })),
    bills: input.bills.map(({ amount, ...rest }) => ({ ...rest, amountCents: dollarsToCents(amount) })),
    spending: input.spending.map(({ monthlyAmount, ...rest }) => ({ ...rest, monthlyAmountCents: dollarsToCents(monthlyAmount) })),
    oneOffs: input.oneOffs.map(({ amount, ...rest }) => ({ ...rest, amountCents: dollarsToCents(amount) })),
  };
}

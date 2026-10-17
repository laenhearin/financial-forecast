// TEST FIXTURES ONLY. The app reads Nessie (src/lib/nessie-profile.ts); lint blocks app imports of this folder.
// Amounts are in dollars for easy editing; normalizeScenario converts them to cents once.
// tightMonth is tuned so scenarios.test.ts passes (checking $500, paycheck $2,250; the first
// draft of $2,450 and $1,650 was too comfortable). Run npm test after editing.
import { ScenarioLoadError } from "../data/dataSource";
import { reportScenarioIssues, validateScenario } from "../data/validateScenario";
import type { Scenario, Schedule } from "../features/big-purchase/types";
import { dollarsToCents } from "../lib/money";

export interface ScenarioInput {
  label: string;
  customerName: string;
  /** The fixture's "today", YYYY-MM-DD. */
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

export type ScenarioId = "tightMonth" | "comfortable";

const tightMonth: ScenarioInput = {
  label: "Tight month",
  customerName: "Fixture Customer",
  asOfDate: "2026-10-17",
  accounts: [
    { id: "checking", nickname: "Everyday Checking", type: "checking", balance: 500, includeInForecast: true },
    { id: "savings", nickname: "Savings", type: "savings", balance: 1200, includeInForecast: false },
  ],
  income: [
    { id: "paycheck", label: "Paycheck", amount: 2250, schedule: { frequency: "biweekly", anchorDate: "2026-10-23" }, isPaycheck: true },
  ],
  bills: [
    { id: "rent", label: "Rent", amount: 1200, schedule: { frequency: "monthly", dayOfMonth: 1 }, category: "housing", cancellable: false, shiftable: false },
    { id: "car-payment", label: "Car payment", amount: 320, schedule: { frequency: "monthly", dayOfMonth: 5 }, category: "transport", cancellable: false, shiftable: true, maxShiftDays: 10 },
    { id: "gym", label: "Gym", amount: 45, schedule: { frequency: "monthly", dayOfMonth: 3 }, category: "health", cancellable: true, shiftable: false },
    { id: "streaming", label: "Streaming", amount: 15.49, schedule: { frequency: "monthly", dayOfMonth: 8 }, category: "entertainment", cancellable: true, shiftable: false },
    { id: "phone", label: "Phone", amount: 85, schedule: { frequency: "monthly", dayOfMonth: 12 }, category: "utilities", cancellable: false, shiftable: true },
    { id: "internet", label: "Internet", amount: 60, schedule: { frequency: "monthly", dayOfMonth: 15 }, category: "utilities", cancellable: false, shiftable: false },
    { id: "car-insurance", label: "Car insurance", amount: 140, schedule: { frequency: "monthly", dayOfMonth: 20 }, category: "transport", cancellable: false, shiftable: true },
    { id: "utilities", label: "Utilities", amount: 110, schedule: { frequency: "monthly", dayOfMonth: 25 }, category: "utilities", cancellable: false, shiftable: true },
  ],
  spending: [
    { id: "groceries", label: "Groceries", monthlyAmount: 390, cuttable: true, maxCutPercent: 10 },
    { id: "dining", label: "Dining out", monthlyAmount: 260, cuttable: true, maxCutPercent: 40 },
    { id: "shopping", label: "Shopping", monthlyAmount: 150, cuttable: true, maxCutPercent: 50 },
    { id: "entertainment", label: "Entertainment", monthlyAmount: 80, cuttable: true, maxCutPercent: 50 },
    { id: "gas", label: "Gas", monthlyAmount: 120, cuttable: false, maxCutPercent: 0 },
  ],
  oneOffs: [
    { id: "car-registration", label: "Car registration", date: "2026-12-12", amount: 260, type: "expense" },
    { id: "holiday-gifts", label: "Holiday gifts", date: "2026-12-20", amount: 300, type: "expense" },
  ],
};

const comfortable: ScenarioInput = {
  ...tightMonth,
  label: "Comfortable",
  income: tightMonth.income.map(income => ({ ...income, amount: 2700 })),
  oneOffs: [],
};

export const scenarios: Record<ScenarioId, ScenarioInput> = { tightMonth, comfortable };

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

/** Throws ScenarioLoadError when the fixture is unknown or fails validation. */
export function loadTestScenario(id: ScenarioId = "tightMonth"): Scenario {
  const input = scenarios[id];
  if (!input) throw new ScenarioLoadError(`Unknown test scenario "${id}".`);
  const scenario = normalizeScenario(id, input);
  const issues = validateScenario(scenario);
  reportScenarioIssues(id, issues);
  const errors = issues.filter(issue => issue.level === "error");
  if (errors.length) throw new ScenarioLoadError(`Test scenario "${id}" is invalid.`, errors.map(issue => issue.message));
  return scenario;
}

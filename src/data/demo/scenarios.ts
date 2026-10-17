// EDIT HERE. Amounts are in dollars; they are converted to cents on load.
// This is fixture data for the demo, not a real customer or live bank data.
// tightMonth is tuned so the demo-lock test passes (checking $500, paycheck $2,250; the first
// draft of $2,450 and $1,650 was too comfortable). Run npm test after editing.
import type { ScenarioInput } from "../scenarioInput";

export const ACTIVE_SCENARIO_ID: ScenarioId = "tightMonth";

export type ScenarioId = "tightMonth" | "comfortable";

const tightMonth: ScenarioInput = {
  label: "Tight month",
  customerName: "Alex Rivera",
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

// Registry. Scenarios in other files can be imported and added here.
export const scenarios: Record<ScenarioId, ScenarioInput> = { tightMonth, comfortable };

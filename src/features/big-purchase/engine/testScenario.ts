import type { Bill, IncomeSource, Scenario, SpendingCategory } from "../types";

/** Small hand-built scenarios for engine tests. Tests do not use the demo file except the demo-lock test. */
export function makeScenario(overrides: Partial<Scenario> & { balanceCents?: number } = {}): Scenario {
  const { balanceCents = 100_000, ...rest } = overrides;
  return {
    id: "test",
    label: "Test scenario",
    customerName: "Test Person",
    asOfDate: "2026-01-01",
    accounts: [{ id: "checking", nickname: "Checking", type: "checking", balanceCents, includeInForecast: true }],
    income: [],
    bills: [],
    spending: [],
    oneOffs: [],
    ...rest,
  };
}

export function paycheck(amountCents: number, anchorDate: string, id = "pay"): IncomeSource {
  return { id, label: "Paycheck", amountCents, schedule: { frequency: "biweekly", anchorDate }, isPaycheck: true };
}

export function monthlyBill(id: string, amountCents: number, dayOfMonth: number, flags: Partial<Bill> = {}): Bill {
  return {
    id, label: id[0].toUpperCase() + id.slice(1), amountCents, schedule: { frequency: "monthly", dayOfMonth },
    category: "bills", cancellable: false, shiftable: false, ...flags,
  };
}

export function category(id: string, monthlyAmountCents: number, flags: Partial<SpendingCategory> = {}): SpendingCategory {
  return { id, label: id[0].toUpperCase() + id.slice(1), monthlyAmountCents, cuttable: false, maxCutPercent: 0, ...flags };
}

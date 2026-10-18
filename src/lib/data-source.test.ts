import { describe, expect, it } from "vitest";
import { FORECAST_TIMING_NOTE, forecastEstimateNote } from "./data-source";

const estimated = { income: [{ id: "nessie-estimated-income", label: "Pay", amountCents: 1, schedule: { frequency: "monthly" as const, dayOfMonth: 1 }, isPaycheck: true }] };

describe("forecastEstimateNote", () => {
  it("names the income source and always explains end-of-day balances and the weekly spending estimate", () => {
    expect(forecastEstimateNote({ income: [{ ...estimated.income[0], id: "plan-income" }] })).toMatch(/^Income is this customer's plan paycheck/);
    expect(forecastEstimateNote(estimated)).toMatch(/^Income is estimated from Nessie deposits that repeat/);
    expect(forecastEstimateNote(estimated)).toContain(FORECAST_TIMING_NOTE);
    expect(FORECAST_TIMING_NOTE).toMatch(/end-of-day/);
  });

  it("describes spending-history coverage in plain words, warning when it is thin", () => {
    expect(forecastEstimateNote({ ...estimated, spendingCoverage: { level: "established", months: 6, spendRecords: 140 } }))
      .toContain("Spending history: established (6.0 months, 140 spending records).");
    expect(forecastEstimateNote({ ...estimated, spendingCoverage: { level: "insufficient", months: 5, spendRecords: 1 } }))
      .toContain("too thin for a reliable estimate (5.0 months, 1 spending record); missing records can make spending look lower than it is.");
  });
});

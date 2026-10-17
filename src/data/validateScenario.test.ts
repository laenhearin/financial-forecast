import { describe, expect, it } from "vitest";
import { makeScenario, monthlyBill, paycheck } from "../features/big-purchase/engine/testScenario";
import { loadDemoScenario } from "./demoDataSource";
import { scenarios } from "./demo/scenarios";
import { normalizeScenario } from "./scenarioInput";
import { validateScenario } from "./validateScenario";

const valid = makeScenario({ income: [paycheck(100_000, "2026-01-09")], bills: [monthlyBill("rent", 50_000, 1)] });

describe("validateScenario", () => {
  it("accepts a well-formed scenario", () => {
    expect(validateScenario(valid)).toEqual([]);
  });

  it("flags a day of month above 31, duplicate ids, and missing paycheck income", () => {
    const messages = (issues: ReturnType<typeof validateScenario>) => issues.map(issue => `${issue.level}: ${issue.message}`).join("\n");
    expect(messages(validateScenario({ ...valid, bills: [monthlyBill("rent", 50_000, 32)] }))).toMatch(/error: Rent: day of month/);
    expect(messages(validateScenario({ ...valid, bills: [monthlyBill("pay", 1, 1)] }))).toMatch(/error: Duplicate id "pay"/);
    expect(messages(validateScenario({ ...valid, income: [] }))).toMatch(/error: The scenario has no paycheck income/);
  });

  it("warns when base cash goes negative", () => {
    const issues = validateScenario({ ...valid, bills: [monthlyBill("rent", 500_000, 1)] });
    expect(issues).toEqual([{ level: "warning", message: expect.stringMatching(/negative .* on February 1, 2026/) }]);
  });
});

describe("demo data", () => {
  it("normalizes dollars to cents once", () => {
    const scenario = normalizeScenario("tightMonth", scenarios.tightMonth);
    expect(scenario.bills.find(bill => bill.id === "streaming")?.amountCents).toBe(1_549);
    expect(scenario.accounts.map(account => account.balanceCents)).toEqual([scenarios.tightMonth.accounts[0].balance * 100, 120_000]);
  });

  it("loads and validates every registered scenario cleanly", () => {
    for (const id of Object.keys(scenarios) as (keyof typeof scenarios)[]) {
      expect(validateScenario(loadDemoScenario(id))).toEqual([]);
    }
  });
});

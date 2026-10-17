import { describe, expect, it } from "vitest";
import { makeScenario, monthlyBill, paycheck } from "../features/big-purchase/engine/testScenario";
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
    expect(validateScenario({ ...valid, income: [] }, { requirePaycheck: false }).filter(issue => issue.level === "error")).toEqual([]);
  });

  it("warns when base cash goes negative", () => {
    const issues = validateScenario({ ...valid, bills: [monthlyBill("rent", 500_000, 1)] });
    expect(issues).toEqual([{ level: "warning", message: expect.stringMatching(/negative .* on February 1, 2026/) }]);
  });
});

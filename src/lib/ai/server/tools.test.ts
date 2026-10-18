import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkPurchase, purchaseRecommendation } from "@/features/calendar/engine/purchaseCheck";
import { dispatchTool, describeToolCall, TOOL_DECLARATIONS } from "./tools";
import { testContext, testScenario } from "./testing";

const context = testContext();

describe("checkPurchase tool", () => {
  it("agrees with the Purchase Advisor's engine for the same input", () => {
    const result = dispatchTool("checkPurchase", { amount: 500, date: "2026-01-02", label: "Headphones" }, context) as Record<string, unknown>;
    const engine = checkPurchase(testScenario(), [], { label: "Headphones", amountCents: 50_000, date: "2026-01-02", accountId: "checking" }, 120_000);
    expect(result).toMatchObject({
      level: engine.level,
      levelLabel: "NEAR CRITICAL",
      recommendation: purchaseRecommendation(engine).title,
      purchase: { label: "Headphones", amount: 500, date: "2026-01-02" },
      criticalBalance: 1200,
      lowestWithPurchase: { date: "2026-01-05", amount: engine.lowestWith.cents / 100 },
      lowestWithoutPurchase: { date: "2026-01-05", amount: 1800 },
      earliestSaferDate: "2026-01-09",
      nextPaycheck: { date: "2026-01-09", amount: 1500 },
    });
  });

  it("defaults the date to today and the label to Purchase", () => {
    expect(dispatchTool("checkPurchase", { amount: 10 }, context)).toMatchObject({ purchase: { label: "Purchase", date: "2026-01-01", amount: 10 } });
  });

  it("returns errors instead of throwing on bad arguments", () => {
    for (const args of [{ amount: -5 }, { amount: 0 }, { amount: "400" }, { amount: 2_000_000 }, { amount: 5, date: "2025-12-31" }, { amount: 5, date: "2026-02-30" }, { amount: 5, date: "2027-01-01" }]) {
      expect(dispatchTool("checkPurchase", args, context)).toHaveProperty("error");
    }
  });

  it.each([0.001, 1.999, NaN, Infinity])("rejects invalid or sub-cent tool amounts: %s", (amount) => {
    expect(dispatchTool("checkPurchase", { amount }, context)).toHaveProperty("error");
    expect(dispatchTool("getGoalTimeline", { cost: amount }, context)).toHaveProperty("error");
    expect(dispatchTool("getGoalTimeline", { cost: 1200, contributionPerPaycheck: amount }, context)).toHaveProperty("error");
  });

  it("preserves a decimal purchase amount to the cent", () => {
    expect(dispatchTool("checkPurchase", { amount: 1.99 }, context)).toMatchObject({ purchase: { amount: 1.99 } });
  });
});

describe("other tools", () => {
  it("getForecast returns days with levels and items, capped at 31 days", () => {
    const result = dispatchTool("getForecast", { startDate: "2026-01-04", endDate: "2026-01-05" }, context) as { days: Array<Record<string, unknown>> };
    expect(result.days).toEqual([
      { date: "2026-01-04", level: "THRIVING", endBalance: 3000, items: [] },
      { date: "2026-01-05", level: "CAUTION", endBalance: 1800, items: [{ label: "Rent", amount: 1200, kind: "bill" }] },
    ]);
    expect(dispatchTool("getForecast", { startDate: "2026-01-01", endDate: "2026-02-01" }, context)).toHaveProperty("error");
    expect(dispatchTool("getForecast", { startDate: "2026-01-05", endDate: "2026-01-04" }, context)).toHaveProperty("error");
  });

  it("getDayDetail explains a day", () => {
    expect(dispatchTool("getDayDetail", { date: "2026-01-09" }, context)).toMatchObject({
      level: "THRIVING", startBalance: 1800, endBalance: 3300, deposits: [{ label: "Paycheck", amount: 1500, kind: "income" }], bills: [],
    });
  });

  it("getGoalTimeline uses the Big Purchase engine", () => {
    const result = dispatchTool("getGoalTimeline", { cost: 1800, contributionPerPaycheck: 300 }, context) as Record<string, unknown>;
    expect(result).toMatchObject({ cost: 1800, contributionPerPaycheck: 300, affordableNow: false });
    expect(result.affordableDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dispatchTool("getGoalTimeline", { cost: 0 }, context)).toHaveProperty("error");
  });

  it("does not call an overdrawn funding plan an affordable purchase date", () => {
    expect(dispatchTool("getGoalTimeline", { cost: 5000, contributionPerPaycheck: 5000 }, context)).toMatchObject({
      affordableDate: null,
      cashShortfall: { date: "2026-01-09", shortfall: 1700 },
      note: expect.stringContaining("No feasible purchase date"),
    });
  });

  it("rejects unknown tools and non-object arguments", () => {
    expect(dispatchTool("transferMoney", { amount: 5 }, context)).toEqual({ error: 'Unknown tool "transferMoney".' });
    expect(dispatchTool("toString", {}, context)).toHaveProperty("error");
    expect(dispatchTool("checkPurchase", "400", context)).toHaveProperty("error");
  });

  it("declares only read-only tools and logs calls without labels", () => {
    expect(TOOL_DECLARATIONS.map((tool) => tool.name)).toEqual(["checkPurchase", "getForecast", "getGoalTimeline", "getDayDetail"]);
    expect(describeToolCall("checkPurchase", { amount: 400, label: "Gift for Jane Doe" })).toBe("checkPurchase(amount=400)");
  });
});

import { describe, expect, it } from "vitest";
import { category, makeScenario, monthlyBill, paycheck } from "../../big-purchase/engine/testScenario";
import { CLEAR_OF_RAIN_CENTS, dayWeather, solveRescue, stormWindows, TIERS, type DayOutlook, type RescueInput } from "./rescue";

const scenario = makeScenario({
  balanceCents: 150_000,
  income: [paycheck(100_000, "2026-01-16")],
  bills: [monthlyBill("rent", 120_000, 10, { category: "housing" })],
  spending: [
    category("dining", 60_000, { cuttable: true, maxCutPercent: 40 }),
    category("fun", 40_000, { cuttable: true, maxCutPercent: 50 }),
    category("shopping", 30_000, { cuttable: true, maxCutPercent: 40 }),
    category("groceries", 40_000),
  ],
});
const input = (protectedIds: string[] = []): RescueInput => ({ scenario, purchases: [], criticalCents: 0, protectedIds: new Set(protectedIds) });

describe("dayWeather", () => {
  it("uses the calendar's balance bands", () => {
    expect(dayWeather(-1, 0)).toBe("downpour");
    expect(dayWeather(0, 0)).toBe("downpour");
    expect(dayWeather(CLEAR_OF_RAIN_CENTS - 1, 0)).toBe("rainy");
    expect(dayWeather(CLEAR_OF_RAIN_CENTS, 0)).toBe("cloudy");
    expect(dayWeather(120_000, 0)).toBe("sunny");
  });
});

describe("stormWindows", () => {
  const day = (date: string, weather: DayOutlook["weather"], cents = 100): DayOutlook => ({ date, weather, cents });
  it("merges storms separated by two sunny days or fewer", () => {
    const windows = stormWindows([
      day("2026-01-02", "cloudy"), day("2026-01-03", "sunny"), day("2026-01-04", "sunny"), day("2026-01-05", "rainy", 5),
      day("2026-01-06", "sunny"), day("2026-01-07", "sunny"), day("2026-01-08", "sunny"), day("2026-01-09", "cloudy"),
    ]);
    expect(windows).toEqual([
      { from: "2026-01-02", to: "2026-01-05", worst: "rainy", lowest: { date: "2026-01-05", cents: 5 } },
      { from: "2026-01-09", to: "2026-01-09", worst: "cloudy", lowest: { date: "2026-01-09", cents: 100 } },
    ]);
  });
});

describe("solveRescue", () => {
  const result = solveRescue(input());

  it("finds a storm and prices doing nothing", () => {
    expect(result.storms.length).toBeGreaterThan(0);
    expect(result.baseline.stormIndex).toBeGreaterThan(0);
    expect(result.costOfInactionCents % 3_500).toBe(0);
  });

  it("keeps trims within each tier's cap and each category's limit", () => {
    for (const plan of result.plans) {
      for (const trim of plan.trims) {
        const limit = scenario.spending.find((c) => c.id === trim.categoryId)!.maxCutPercent;
        expect(trim.percent).toBeLessThanOrEqual(Math.min(plan.spec.maxTrimPercent, limit));
      }
      expect(plan.trims.length).toBeLessThanOrEqual(plan.spec.maxCategories);
      expect(plan.trims.some((t) => t.categoryId === "groceries")).toBe(false);
    }
  });

  it("never trims a protected category", () => {
    for (const plan of solveRescue(input(["dining"])).plans) expect(plan.trims.some((t) => t.categoryId === "dining")).toBe(false);
  });

  it("never makes a day worse than doing nothing", () => {
    for (const plan of result.plans) {
      plan.metrics.days.forEach((day, i) => expect(day.cents).toBeGreaterThanOrEqual(result.baseline.days[i].cents));
    }
  });

  it("orders tiers from gentle to aggressive", () => {
    const indexes = result.plans.map((p) => p.metrics.stormIndex);
    expect([...indexes].sort((a, b) => b - a)).toEqual(indexes);
    expect(result.plans.length + result.collapsed.length).toBe(TIERS.length);
  });

  it("is deterministic and fast", () => {
    const started = performance.now();
    const again = solveRescue(input());
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(again).toEqual(result);
  });

  it("returns no plans when there is no storm", () => {
    const calm = solveRescue({ ...input(), scenario: makeScenario({ balanceCents: 1_000_000 }) });
    expect(calm.storms).toEqual([]);
    expect(calm.plans).toEqual([]);
  });
});

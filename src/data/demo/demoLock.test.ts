import { describe, expect, it } from "vitest";
import { addMonths } from "../../lib/dates";
import { projectBase } from "../../features/big-purchase/engine/base";
import { computeForecast } from "../../features/big-purchase/engine/forecast";
import { loadDemoScenario } from "../demoDataSource";

// Locks the demo's tuning targets. If an edit to scenarios.ts breaks one, retune the numbers there.
const scenario = loadDemoScenario("tightMonth");
const laptop = { costCents: 180_000, bufferCents: 27_000, contributionCents: null };

describe("demo lock: tightMonth", () => {
  it("never takes base cash below $0", () => {
    expect(Math.min(...projectBase(scenario).days.map(day => day.baseCents))).toBeGreaterThanOrEqual(0);
  });

  it("feels tight: the lowest base cash in the first 60 days is $150 to $400", () => {
    const lowest = Math.min(...projectBase(scenario).days.slice(0, 61).map(day => day.baseCents));
    expect(lowest).toBeGreaterThanOrEqual(15_000);
    expect(lowest).toBeLessThanOrEqual(40_000);
  });

  it("suggests $150 to $250 per paycheck for an $1,800 laptop, affordable 3 to 6 months out", () => {
    const result = computeForecast(scenario, laptop);
    if (!result.ok) throw new Error(result.message);
    const { suggestedContributionCents, plan } = result.forecast;
    expect(suggestedContributionCents).toBeGreaterThanOrEqual(15_000);
    expect(suggestedContributionCents).toBeLessThanOrEqual(25_000);
    expect(plan.affordableDate).not.toBeNull();
    expect(plan.affordableDate! >= addMonths(scenario.asOfDate, 3)).toBe(true);
    expect(plan.affordableDate! <= addMonths(scenario.asOfDate, 6)).toBe(true);
  });
});

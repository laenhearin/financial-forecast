import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "../lib/dates";
import { generateAdvice } from "../features/big-purchase/advice/generateAdvice";
import { projectBase } from "../features/big-purchase/engine/base";
import { computeForecast } from "../features/big-purchase/engine/forecast";
import { ScenarioLoadError } from "../data/dataSource";
import { validateScenario } from "../data/validateScenario";
import { loadTestScenario, normalizeScenario, scenarios } from "./scenarios";

// Locks the fixture's tuning targets. If an edit to scenarios.ts breaks one, retune the numbers there.
const scenario = loadTestScenario("tightMonth");
const laptop = { costCents: 180_000, bufferCents: 27_000, contributionCents: null };

describe("fixture lock: tightMonth", () => {
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

  it("has at least two advice items that bring the date two or more weeks earlier", () => {
    const result = computeForecast(scenario, laptop);
    if (!result.ok) throw new Error(result.message);
    const deadline = addDays(result.forecast.plan.affordableDate!, -30);
    const advice = generateAdvice(scenario, laptop, result.forecast, deadline);
    expect(advice.items.filter(item => (item.daysSooner ?? 0) >= 14).length).toBeGreaterThanOrEqual(2);
  });
});

describe("fixture scenarios", () => {
  it("normalizes dollars to cents once", () => {
    const normalized = normalizeScenario("tightMonth", scenarios.tightMonth);
    expect(normalized.bills.find(bill => bill.id === "streaming")?.amountCents).toBe(1_549);
    expect(normalized.accounts.map(account => account.balanceCents)).toEqual([scenarios.tightMonth.accounts[0].balance * 100, 120_000]);
  });

  it("reports an unknown scenario as a load error", () => {
    expect(() => loadTestScenario("missing" as never)).toThrow(ScenarioLoadError);
  });

  it("loads and validates every registered scenario cleanly", () => {
    for (const id of Object.keys(scenarios) as (keyof typeof scenarios)[]) {
      expect(validateScenario(loadTestScenario(id))).toEqual([]);
    }
  });
});

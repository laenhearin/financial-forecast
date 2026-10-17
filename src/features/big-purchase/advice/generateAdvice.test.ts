import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "../../../lib/dates";
import { templateNarrator } from "../ai/narrator";
import { computeForecast, type ForecastGoal } from "../engine/forecast";
import { category, makeScenario, monthlyBill, paycheck } from "../engine/testScenario";
import { createGoal } from "../state/goalStore";
import type { AdviceItem, Forecast, ScenarioMods } from "../types";
import { generateAdvice } from "./generateAdvice";

// Hand-built tight scenario with every kind of lever.
const scenario = makeScenario({
  asOfDate: "2026-10-17",
  balanceCents: 50_000,
  income: [paycheck(225_000, "2026-10-23")],
  bills: [
    monthlyBill("rent", 120_000, 1),
    monthlyBill("car", 32_000, 5, { shiftable: true, maxShiftDays: 10 }),
    monthlyBill("gym", 4_500, 3, { cancellable: true }),
    monthlyBill("streaming", 1_549, 8, { cancellable: true }),
    monthlyBill("insurance", 14_000, 20, { shiftable: true }),
  ],
  spending: [
    category("groceries", 39_000, { cuttable: true, maxCutPercent: 10 }),
    category("dining", 26_000, { cuttable: true, maxCutPercent: 40 }),
    category("shopping", 15_000, { cuttable: true, maxCutPercent: 50 }),
    category("gas", 12_000),
  ],
});
const goal: ForecastGoal = { costCents: 180_000, bufferCents: 27_000, contributionCents: null };

function forecastFor(g: ForecastGoal = goal, mods: ScenarioMods = {}): Forecast {
  const result = computeForecast(scenario, g, mods);
  if (!result.ok) throw new Error(result.message);
  return result.forecast;
}

function rerun(item: AdviceItem): string | null {
  const p = item.params;
  switch (item.type) {
    case "raise-contribution": return forecastFor({ ...goal, contributionCents: Number(p.newContributionCents) }).plan.affordableDate;
    case "shift-bill": return forecastFor(goal, { billDueDays: { [String(p.billId)]: Number(p.newDay) } }).plan.affordableDate;
    case "cut-recurring": return forecastFor(goal, { removedBillIds: [String(p.billId)] }).plan.affordableDate;
    case "trim-category": return forecastFor(goal, { categoryCutPercents: { [String(p.categoryId)]: Number(p.cutPercent) } }).plan.affordableDate;
  }
}

const current = forecastFor();
const deadline = addDays(current.plan.affordableDate!, -45);
const advice = generateAdvice(scenario, goal, current, deadline);

describe("generateAdvice", () => {
  it("reports the gap to the deadline", () => {
    expect(advice.onTrack).toBe(false);
    expect(advice.gapDays).toBe(45);
  });

  it("reports days sooner equal to the difference of two full forecast runs", () => {
    expect(advice.items.length).toBeGreaterThan(0);
    for (const item of advice.items) {
      const date = rerun(item);
      expect(date).toBe(item.newAffordableDate);
      expect(item.daysSooner).toBe(daysBetween(date!, current.plan.affordableDate!));
      expect(item.daysSooner!).toBeGreaterThan(0);
      expect(item.meetsDeadline).toBe(date! <= deadline);
    }
  });

  it("sorts by days sooner, then easier first, and returns at most 5", () => {
    expect(advice.items.length).toBeLessThanOrEqual(5);
    const ease = { easy: 0, medium: 1, hard: 2 };
    for (let i = 1; i < advice.items.length; i++) {
      const [a, b] = [advice.items[i - 1], advice.items[i]];
      expect(a.daysSooner! > b.daysSooner! || (a.daysSooner === b.daysSooner && ease[a.ease] <= ease[b.ease])).toBe(true);
    }
  });

  it("suggests raising a contribution that is below the suggested amount", () => {
    // $100 paychecks, $250 goal, $50 buffer: suggested $50 funds on the 5th payday (Feb 27); $25 takes 10.
    const simple = makeScenario({ balanceCents: 0, income: [paycheck(10_000, "2026-01-02")] });
    const typed: ForecastGoal = { costCents: 25_000, bufferCents: 5_000, contributionCents: 2_500 };
    const result = computeForecast(simple, typed);
    if (!result.ok) throw new Error(result.message);
    const { items } = generateAdvice(simple, typed, result.forecast, "2026-02-27");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "raise-contribution", daysSooner: 70, newAffordableDate: "2026-02-27", ease: "easy", meetsDeadline: true });
    expect(items[0].reason).toBe("Your safe suggested amount is $50 per paycheck and you are using $25. Raising it moves your date up 70 days while keeping cash above your buffer.");
  });

  it("raises to what the deadline needs, up to the limit, and notes the buffer dip", () => {
    const simple = makeScenario({ balanceCents: 0, income: [paycheck(10_000, "2026-01-02")] });
    const typed: ForecastGoal = { costCents: 25_000, bufferCents: 5_000, contributionCents: null };
    const result = computeForecast(simple, typed);
    if (!result.ok) throw new Error(result.message);
    const raise = generateAdvice(simple, typed, result.forecast, "2026-01-30").items[0];
    expect(raise).toMatchObject({ type: "raise-contribution", newAffordableDate: "2026-01-30", params: { newContributionCents: 8_500, aboveSuggested: 1 } });
    expect(raise.reason).toMatch(/above your safe suggested amount of \$50, so cash would dip under your \$50 buffer/);
  });

  it("returns no advice when on track", () => {
    expect(generateAdvice(scenario, goal, current, addDays(current.plan.affordableDate!, 10))).toEqual({ onTrack: true, gapDays: -10, items: [], combined: null });
  });

  it("combines items in ranked order until the deadline is met", () => {
    expect(advice.combined).not.toBeNull();
    const { itemIds, reachesDeadline, earliestDate } = advice.combined!;
    expect(itemIds).toEqual(advice.items.slice(0, itemIds.length).map(item => item.id));
    if (reachesDeadline) expect(earliestDate! <= deadline).toBe(true);
  });

  it("reports a new date instead of days sooner when the goal is out of reach", () => {
    const outOfReach: ForecastGoal = { ...goal, contributionCents: 500 };
    const result = generateAdvice(scenario, outOfReach, forecastFor(outOfReach), null);
    expect(result.gapDays).toBeNull();
    expect(result.items.every(item => item.daysSooner === null && item.newAffordableDate !== null)).toBe(true);
  });
});

describe("templateNarrator", () => {
  it("summarizes the plan and the top change", async () => {
    const g = { ...createGoal("g", "2026-10-17", { name: "Laptop", costCents: 180_000 }), preferredDeadline: deadline };
    const text = await templateNarrator.narrate({ goal: g, forecast: current, advice });
    expect(text).toMatch(/^At \$\d+ per paycheck you can afford your laptop on [A-Z][a-z]+ \d+\. To reach your [A-Z][a-z]+ \d+ deadline, the biggest single change is [a-z]+ .+, which gets you there \d+ days sooner\./);
  });
});

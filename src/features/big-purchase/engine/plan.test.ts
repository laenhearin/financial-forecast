import { describe, expect, it } from "vitest";
import { projectBase } from "./base";
import { requiredContribution } from "./deadline";
import { computeForecast } from "./forecast";
import { contributionLimit, maxCandidateCents, suggestedContribution } from "./limits";
import { simulatePlan } from "./plan";
import { category, makeScenario, monthlyBill, paycheck } from "./testScenario";
import type { Scenario } from "../types";

// Hand-checkable: $0 cash, $100 paychecks every other Friday from Jan 2, nothing else.
// Base on the k-th payday is $100k. Goal: $250 with a $50 buffer.
const tiny = makeScenario({ balanceCents: 0, income: [paycheck(10_000, "2026-01-02")] });
const tinyBase = projectBase(tiny);
const goal = { costCents: 25_000, bufferCents: 5_000 };
const max = maxCandidateCents(tiny, goal.costCents);
const paydays = tinyBase.paydays; // Jan 2, Jan 16, Jan 30, Feb 13, Feb 27, ...

describe("simulatePlan", () => {
  it("makes the last contribution partial so the earmark ends exactly at the cost", () => {
    const plan = simulatePlan(tinyBase.days, paydays, goal, 10_000, 0);
    const earmarks = paydays.slice(0, 4).map(date => plan.days.find(day => day.date === date)?.earmarkCents);
    expect(earmarks).toEqual([10_000, 20_000, 25_000, 25_000]);
    expect(Math.max(...plan.days.map(day => day.earmarkCents))).toBe(25_000);
    expect(plan.affordableDate).toBe("2026-01-30");
    expect(plan.paycheckCount).toBe(3);
  });

  it("sets P to the first paycheck where the earmark equals the cost, and commits the cost from then on", () => {
    const plan = simulatePlan(tinyBase.days, paydays, goal, 5_000, goal.bufferCents);
    expect(plan.affordableDate).toBe("2026-02-27");
    const after = plan.days.filter(day => day.date >= "2026-02-27");
    expect(after.every(day => day.committedCents === 25_000 && day.spendableCents === day.baseCents - 25_000)).toBe(true);
    expect(plan.days[0]).toMatchObject({ earmarkCents: 0, committedCents: 0, spendableCents: 0 });
  });

  it("returns a null date when the cost is not reachable in the horizon", () => {
    const plan = simulatePlan(tinyBase.days, paydays, { costCents: 20_000_000, bufferCents: 5_000 }, 10_000, 0);
    expect(plan.affordableDate).toBeNull();
    expect(plan.paycheckCount).toBe(0);
  });

  it("is affordable now when the full cost fits above the buffer on every day", () => {
    const rich = makeScenario({ balanceCents: 100_000, income: [paycheck(10_000, "2026-01-02")] });
    const plan = simulatePlan(projectBase(rich).days, projectBase(rich).paydays, { costCents: 50_000, bufferCents: 20_000 }, 10_000, 20_000);
    expect(plan).toMatchObject({ affordableNow: true, affordableDate: "2026-01-01", paycheckCount: 0, contributionCents: 0, tier: "ok" });
  });
});

describe("suggested contribution and limit", () => {
  it("finds the hand-calculated suggestion and limit", () => {
    expect(suggestedContribution(tinyBase.days, paydays, goal, max)).toBe(5_000);
    expect(contributionLimit(tinyBase.days, paydays, goal, max)).toBe(10_000);
  });

  it("are both $0 when cash never exceeds the floor", () => {
    const flat = makeScenario({ balanceCents: 0, income: [paycheck(10_000, "2026-01-02")], bills: [{ ...monthlyBill("drain", 10_000, 1), schedule: { frequency: "biweekly", anchorDate: "2026-01-02" } }] });
    const base = projectBase(flat);
    expect(suggestedContribution(base.days, base.paydays, goal, max)).toBe(0);
    expect(contributionLimit(base.days, base.paydays, goal, max)).toBe(0);
  });

  it("suggests $0 when the buffer is larger than cash ever available, but the limit can still be positive", () => {
    const result = computeForecast(tiny, { costCents: 25_000, bufferCents: 10_000_000, contributionCents: null });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast.suggestedContributionCents).toBe(0);
    expect(result.forecast.limitContributionCents).toBe(10_000);
    expect(result.forecast.plan.affordableDate).toBeNull();
  });
});

describe("tiers", () => {
  it("is ok at the suggested amount", () => {
    expect(simulatePlan(tinyBase.days, paydays, goal, 5_000, goal.bufferCents).tier).toBe("ok");
  });

  it("is a notice when cash dips under the buffer but never goes negative", () => {
    const plan = simulatePlan(tinyBase.days, paydays, goal, 7_500, goal.bufferCents);
    expect(plan.tier).toBe("notice");
    expect(plan.violations[0]).toEqual({ date: "2026-01-02", kind: "below-buffer", shortfallCents: 2_500 });
    expect(plan.lowestSpendableCents).toBeGreaterThanOrEqual(0);
  });

  it("is an alert above the limit, naming the first negative date and shortfall, and the forecast still renders", () => {
    const result = computeForecast(tiny, { ...goal, contributionCents: 15_000 });
    if (!result.ok) throw new Error(result.message);
    const { plan } = result.forecast;
    expect(plan.tier).toBe("alert");
    expect(plan.violations.find(v => v.kind === "negative")).toEqual({ date: "2026-01-02", kind: "negative", shortfallCents: 5_000 });
    expect(result.forecast.days.length).toBeGreaterThan(700);
  });
});

describe("requiredContribution", () => {
  it("returns the smallest working amount and its tier", () => {
    expect(requiredContribution(tinyBase.days, paydays, goal, "2026-01-30", max)).toEqual({ contributionCents: 8_500, tier: "notice" });
    expect(requiredContribution(tinyBase.days, paydays, goal, "2026-02-27", max)).toEqual({ contributionCents: 5_000, tier: "ok" });
  });

  it("returns null when no amount meets the deadline without going negative", () => {
    expect(requiredContribution(tinyBase.days, paydays, goal, "2026-01-16", max)).toBeNull();
  });
});

describe("computeForecast", () => {
  it("flags an existing cash shortfall even when the suggested contribution is zero", () => {
    const short = makeScenario({ balanceCents: 5_000, income: [paycheck(10_000, "2026-01-09")], bills: [monthlyBill("rent", 20_000, 5)] });
    const result = computeForecast(short, { ...goal, contributionCents: null });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast.suggestedContributionCents).toBe(0);
    expect(result.forecast.plan.tier).toBe("alert");
    expect(result.forecast.plan.violations[0]).toEqual({ date: "2026-01-05", kind: "negative", shortfallCents: 15_000 });
  });

  it("does not suggest a contribution when cash is negative before the first payday", () => {
    const recovering = makeScenario({ balanceCents: -100, income: [paycheck(100_000, "2026-01-02")] });
    const result = computeForecast(recovering, { ...goal, contributionCents: null });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast.suggestedContributionCents).toBe(0);
    expect(result.forecast.limitContributionCents).toBe(0);
    expect(result.forecast.plan.tier).toBe("alert");
  });

  it("recognizes an already affordable goal even without future paychecks", () => {
    const result = computeForecast(makeScenario({ balanceCents: 100_000 }), { ...goal, contributionCents: null });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast.plan).toMatchObject({ affordableNow: true, affordableDate: "2026-01-01", contributionCents: 0 });
  });

  it("asks for a cost when it is zero", () => {
    expect(computeForecast(tiny, { costCents: 0, bufferCents: 20_000, contributionCents: null })).toMatchObject({ ok: false, issue: "missing-cost" });
  });

  it("funds a $1 goal on the first paycheck without overshooting it (review test 21)", () => {
    const result = computeForecast(tiny, { costCents: 100, bufferCents: 5_000, contributionCents: null });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast.plan).toMatchObject({ affordableDate: "2026-01-02", paycheckCount: 1, tier: "ok" });
    expect(Math.max(...result.forecast.days.map(day => day.earmarkCents))).toBe(100);
  });

  it("treats a $0 contribution as never reaching the goal, without looping or dividing by zero (review test 24)", () => {
    const result = computeForecast(tiny, { ...goal, contributionCents: 0 });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast.plan).toMatchObject({ contributionCents: 0, affordableDate: null, paycheckCount: 0 });
    expect(result.forecast.days.every(day => day.earmarkCents === 0)).toBe(true);
  });

  it("flags a contribution larger than the paycheck instead of accepting it (review test 30)", () => {
    const result = computeForecast(tiny, { ...goal, contributionCents: 50_000 });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast.limitContributionCents).toBeLessThanOrEqual(10_000);
    expect(result.forecast.plan.tier).toBe("alert");
    expect(result.forecast.plan.violations[0]).toMatchObject({ date: "2026-01-02", kind: "negative" });
  });

  it("reports an error state, not a crash, without enough cash or paycheck income", () => {
    expect(computeForecast(makeScenario({ balanceCents: 0 }), { ...goal, contributionCents: null })).toMatchObject({ ok: false, issue: "no-paycheck" });
  });

  it("uses the suggested amount when no contribution is typed, capped at 20% of the paycheck", () => {
    // $50 would keep cash above the buffer, but the suggestion stops at 20% of $100.
    const result = computeForecast(tiny, { ...goal, contributionCents: null });
    if (!result.ok) throw new Error(result.message);
    expect(result.forecast).toMatchObject({ suggestedContributionCents: 2_000, limitContributionCents: 10_000 });
    expect(result.forecast.plan).toMatchObject({ contributionCents: 2_000, affordableDate: "2026-06-19", paycheckCount: 13, tier: "ok" });
  });

  it("builds funding points that start at 0% and end at 100% on the affordable date", () => {
    const result = computeForecast(tiny, { ...goal, contributionCents: 5_000 });
    if (!result.ok) throw new Error(result.message);
    const { funding } = result.forecast;
    expect(funding.map(point => point.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-16", "2026-01-30", "2026-02-13", "2026-02-27"]);
    expect(funding.map(point => point.percentFunded)).toEqual([0, 20, 40, 60, 80, 100]);
  });
});

describe("invariant and never-negative properties", () => {
  it("keeps committed cash within max(0, base - floor) for suggested and limit plans across random scenarios", () => {
    const random = mulberry32(20261017);
    const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
    for (let run = 0; run < 60; run++) {
      const scenario: Scenario = makeScenario({
        asOfDate: "2026-10-17",
        balanceCents: between(0, 500_000),
        income: [paycheck(between(50_000, 400_000), `2026-10-${String(between(18, 31)).padStart(2, "0")}`)],
        bills: Array.from({ length: between(0, 6) }, (_, i) => monthlyBill(`bill${i}`, between(1_000, 150_000), between(1, 31))),
        spending: Array.from({ length: between(0, 4) }, (_, i) => category(`cat${i}`, between(0, 80_000))),
        oneOffs: [{ id: "once", label: "Once", date: "2027-01-15", amountCents: between(0, 300_000), type: "expense" }],
      });
      const runGoal = { costCents: between(5_000, 2_000_000), bufferCents: between(0, 100_000) };
      const base = projectBase(scenario);
      const runMax = maxCandidateCents(scenario, runGoal.costCents);
      const suggested = suggestedContribution(base.days, base.paydays, runGoal, runMax);
      const limit = contributionLimit(base.days, base.paydays, runGoal, runMax);
      expect(limit).toBeGreaterThanOrEqual(suggested);
      expect(suggested % 500).toBe(0);
      expect(limit % 500).toBe(0);
      for (const [contribution, floor] of [[suggested, runGoal.bufferCents], [limit, 0]] as const) {
        const plan = simulatePlan(base.days, base.paydays, runGoal, contribution, floor);
        for (const day of plan.days) {
          expect(day.committedCents).toBeLessThanOrEqual(Math.max(0, day.baseCents - floor));
          if (day.baseCents >= 0) expect(day.spendableCents).toBeGreaterThanOrEqual(0);
        }
        if (plan.affordableDate && floor > 0) {
          expect(plan.days.filter(day => day.date >= plan.affordableDate!).every(day => day.spendableCents >= runGoal.bufferCents)).toBe(true);
        }
      }
    }
  });
});

/** Small seeded PRNG so the randomized test is deterministic. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

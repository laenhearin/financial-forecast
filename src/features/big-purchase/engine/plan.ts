import type { Cents, DayPoint, ISODate, Plan, Tier, Violation } from "../types";
import type { BaseDay } from "./base";

export interface PlanGoal { costCents: Cents; bufferCents: Cents }
export interface PlanSimulation extends Plan { days: DayPoint[] }

/** Rule 7: the full cost can be held from day 0 while every day keeps the buffer. */
export function isAffordableNow(base: BaseDay[], goal: PlanGoal): boolean {
  return base.every(day => goal.costCents <= Math.max(0, day.baseCents - goal.bufferCents));
}

/** Contributions needed for a plan, ignoring feasibility. */
export function paycheckCountFor(costCents: Cents, contributionCents: Cents): number {
  return contributionCents > 0 ? Math.ceil(costCents / contributionCents) : Number.POSITIVE_INFINITY;
}

/** Affordable date for a contribution: the paycheck on which the earmark reaches the cost. */
export function affordableDateFor(paydays: ISODate[], costCents: Cents, contributionCents: Cents): ISODate | null {
  const count = paycheckCountFor(costCents, contributionCents);
  return count <= paydays.length ? paydays[count - 1] : null;
}

/**
 * Fast invariant check used by the contribution scans: committed cash never exceeds
 * max(0, base - floor). Committed equals the earmark, which is capped at the cost.
 */
export function satisfiesInvariant(base: BaseDay[], paydays: ISODate[], costCents: Cents, contributionCents: Cents, floorCents: Cents): boolean {
  const paydaySet = new Set(paydays);
  let earmark = 0;
  for (const day of base) {
    // An existing cash shortfall cannot support a "never negative" savings recommendation.
    if (day.baseCents < 0) return false;
    if (earmark < costCents && paydaySet.has(day.date)) earmark += Math.min(contributionCents, costCents - earmark);
    if (earmark > Math.max(0, day.baseCents - floorCents)) return false;
  }
  return true;
}

export function classifyTier(violations: Violation[]): Tier {
  if (violations.some(violation => violation.kind === "negative")) return "alert";
  return violations.length ? "notice" : "ok";
}

/**
 * Runs contributions across the horizon and records every day where the goal holds more
 * than the cash above the floor. Paydays must be after the as-of date (base[0]).
 */
export function simulatePlan(base: BaseDay[], paydays: ISODate[], goal: PlanGoal, contributionCents: Cents, floorCents: Cents): PlanSimulation {
  if (!base.length) throw new Error("The base projection is empty.");
  if (!Number.isSafeInteger(contributionCents) || contributionCents < 0) throw new Error("Contribution must be nonnegative integer cents.");
  if (!(goal.costCents > 0)) throw new Error("Cost must be greater than zero.");

  const affordableNow = isAffordableNow(base, goal);
  const paydaySet = new Set(paydays);
  let earmark = affordableNow ? goal.costCents : 0;
  let affordableDate: ISODate | null = affordableNow ? base[0].date : null;
  let paycheckCount = 0;
  const violations: Violation[] = [];
  let lowest = { cents: Number.POSITIVE_INFINITY, date: base[0].date };

  const days = base.map(({ date, baseCents }): DayPoint => {
    if (!affordableNow && earmark < goal.costCents && paydaySet.has(date) && contributionCents > 0) {
      earmark += Math.min(contributionCents, goal.costCents - earmark);
      paycheckCount++;
      if (earmark === goal.costCents) affordableDate = date;
    }
    const committedCents = earmark; // the earmark before P, the full cost from P on
    const spendableCents = baseCents - committedCents;
    if (spendableCents < 0 || committedCents > Math.max(0, baseCents - floorCents)) {
      violations.push(spendableCents < 0
        ? { date, kind: "negative", shortfallCents: -spendableCents }
        : { date, kind: "below-buffer", shortfallCents: floorCents - spendableCents });
    }
    if (spendableCents < lowest.cents) lowest = { cents: spendableCents, date };
    return { date, baseCents, earmarkCents: earmark, committedCents, spendableCents };
  });

  return {
    contributionCents: affordableNow ? 0 : contributionCents,
    affordableDate,
    affordableNow,
    paycheckCount: affordableDate ? paycheckCount : 0,
    violations,
    tier: classifyTier(violations),
    lowestSpendableCents: lowest.cents,
    lowestSpendableDate: lowest.date,
    days,
  };
}

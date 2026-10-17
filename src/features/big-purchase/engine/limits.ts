import { roundDownToStep, roundUpToStep } from "../../../lib/money";
import { CONTRIBUTION_STEP_CENTS } from "../config";
import type { Cents, ISODate, Scenario } from "../types";
import type { BaseDay } from "./base";
import { satisfiesInvariant, type PlanGoal } from "./plan";

export { classifyTier } from "./plan";

/**
 * Highest contribution worth scanning: the largest paycheck, but never more than the cost
 * (rounded up to a step), since any larger amount funds the goal on the same paycheck.
 */
export function maxCandidateCents(scenario: Scenario, costCents: Cents): Cents {
  const largestPaycheck = Math.max(0, ...scenario.income.filter(income => income.isPaycheck).map(income => income.amountCents));
  return Math.min(roundDownToStep(largestPaycheck, CONTRIBUTION_STEP_CENTS), roundUpToStep(costCents, CONTRIBUTION_STEP_CENTS));
}

/**
 * Largest step multiple whose plan has no violations at the floor. Scans every candidate from the
 * top down rather than assuming feasibility is monotonic.
 */
function largestFeasible(base: BaseDay[], paydays: ISODate[], costCents: Cents, floorCents: Cents, maxCents: Cents): Cents {
  for (let candidate = roundDownToStep(maxCents, CONTRIBUTION_STEP_CENTS); candidate >= CONTRIBUTION_STEP_CENTS; candidate -= CONTRIBUTION_STEP_CENTS) {
    if (satisfiesInvariant(base, paydays, costCents, candidate, floorCents)) return candidate;
  }
  return 0;
}

/** Rule 3: largest $5 multiple that keeps cash at or above the buffer. */
export function suggestedContribution(base: BaseDay[], paydays: ISODate[], goal: PlanGoal, maxCents: Cents): Cents {
  return largestFeasible(base, paydays, goal.costCents, goal.bufferCents, maxCents);
}

/** Rule 4: largest $5 multiple that keeps cash from going negative; never below the suggestion. */
export function contributionLimit(base: BaseDay[], paydays: ISODate[], goal: PlanGoal, maxCents: Cents): Cents {
  return Math.max(largestFeasible(base, paydays, goal.costCents, 0, maxCents), suggestedContribution(base, paydays, goal, maxCents));
}

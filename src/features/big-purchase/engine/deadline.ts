import { CONTRIBUTION_STEP_CENTS } from "../config";
import type { Cents, ISODate, Tier } from "../types";
import type { BaseDay } from "./base";
import { affordableDateFor, isAffordableNow, satisfiesInvariant, simulatePlan, type PlanGoal } from "./plan";

export interface RequiredContribution { contributionCents: Cents; tier: Tier }

/**
 * Smallest $5 multiple whose plan is affordable on or before the deadline without cash going
 * negative. Its tier tells the UI whether it dips under the buffer. Null when none works.
 */
export function requiredContribution(base: BaseDay[], paydays: ISODate[], goal: PlanGoal, deadline: ISODate, maxCents: Cents): RequiredContribution | null {
  if (isAffordableNow(base, goal)) return { contributionCents: 0, tier: "ok" };
  // A local copy: Next 16.4's Turbopack build renames the imported constant but misses it in a
  // for-loop update clause, leaving "CONTRIBUTION_STEP_CENTS is not defined" in production bundles.
  const step = CONTRIBUTION_STEP_CENTS;
  for (let candidate = step; candidate <= maxCents; candidate += step) {
    const date = affordableDateFor(paydays, goal.costCents, candidate);
    if (!date || date > deadline) continue;
    if (!satisfiesInvariant(base, paydays, goal.costCents, candidate, 0)) continue;
    return { contributionCents: candidate, tier: simulatePlan(base, paydays, goal, candidate, goal.bufferCents).tier };
  }
  return null;
}

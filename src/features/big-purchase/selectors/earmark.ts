import type { Cents, Forecast, Goal, GoalStatus } from "../types";

export interface EarmarkSummary {
  label: string;               // "{name} money"
  earmarkedTodayCents: Cents;  // virtual hold as of today; zero unless the goal is active
  contributionCents: Cents;
  targetCents: Cents;
  status: GoalStatus;
}

/** For other sections of the app (for example an accounts view). No money moves; this is a virtual hold. */
export function getEarmarkSummary(goal: Goal, forecast: Forecast | null): EarmarkSummary {
  return {
    label: `${goal.name.trim() || "Goal"} money`,
    earmarkedTodayCents: goal.status === "active" && forecast ? forecast.days[0].earmarkCents : 0,
    contributionCents: forecast?.plan.contributionCents ?? goal.contributionCents ?? 0,
    targetCents: goal.costCents,
    status: goal.status,
  };
}

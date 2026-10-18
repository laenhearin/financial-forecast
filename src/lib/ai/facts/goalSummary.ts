import { generateAdvice } from "@/features/big-purchase/advice/generateAdvice";
import { computeForecast } from "@/features/big-purchase/engine/forecast";
import type { AdviceResult, Forecast, Scenario } from "@/features/big-purchase/types";
import type { GoalSummaryFacts, GoalSummaryRequest, ISODate } from "../types";

/** Facts for the Big Purchase summary, straight from the forecast and advice engines. */
export function goalSummaryFacts(goalName: string, costCents: number, bufferCents: number, deadline: ISODate | null, forecast: Forecast, advice: AdviceResult | null): GoalSummaryFacts {
  const { plan } = forecast;
  const shortfall = plan.violations.find(violation => violation.kind === "negative");
  return {
    goalName,
    costCents,
    bufferCents,
    contributionPerPaycheckCents: plan.contributionCents,
    affordableNow: plan.affordableNow,
    affordableDate: shortfall ? null : plan.affordableDate,
    cashShortfall: shortfall ? { date: shortfall.date, cents: shortfall.shortfallCents } : null,
    horizonEndDate: forecast.horizonEndDate,
    deadline,
    onTrack: advice ? advice.onTrack : null,
    changes: (advice?.items ?? []).map((item) => ({
      title: item.title,
      reason: item.reason,
      daysSooner: item.daysSooner,
      newAffordableDate: item.newAffordableDate,
      meetsDeadline: item.meetsDeadline,
    })),
    combined: advice?.combined
      ? { count: advice.combined.itemIds.length, reachesDeadline: advice.combined.reachesDeadline, earliestDate: advice.combined.earliestDate }
      : null,
  };
}

/** Server side: recompute the forecast and advice from the goal inputs. Null when the goal has no forecast. */
export function buildGoalSummaryFacts(scenario: Scenario, { goal }: GoalSummaryRequest): GoalSummaryFacts | null {
  const forecastGoal = { costCents: goal.costCents, bufferCents: goal.bufferCents, contributionCents: goal.contributionCents };
  const result = computeForecast(scenario, forecastGoal);
  if (!result.ok) return null;
  const advice = generateAdvice(scenario, forecastGoal, result.forecast, goal.deadline);
  return goalSummaryFacts(goal.name, goal.costCents, goal.bufferCents, goal.deadline, result.forecast, advice);
}

import { MAX_COST_CENTS } from "../config";
import type { Cents, ForecastResult, Goal, Scenario, ScenarioMods } from "../types";
import { projectBase } from "./base";
import { contributionLimit, maxCandidateCents, suggestedContribution, suggestedContributionCapCents } from "./limits";
import { isAffordableNow, simulatePlan } from "./plan";
import { buildFunding } from "./series";

export type ForecastGoal = Pick<Goal, "costCents" | "bufferCents" | "contributionCents">;

/** Composes the engine: base projection, suggested and limit scans, the plan in effect, and chart series. */
export function computeForecast(scenario: Scenario, goal: ForecastGoal, mods: ScenarioMods = {}): ForecastResult {
  const { costCents, bufferCents, contributionCents } = goal;
  if (!Number.isSafeInteger(costCents) || costCents <= 0) {
    return { ok: false, issue: "missing-cost", message: "Enter a cost to see your forecast." };
  }
  if (costCents > MAX_COST_CENTS || !isNonnegativeCents(bufferCents) || (contributionCents !== null && !isNonnegativeCents(contributionCents))) {
    return { ok: false, issue: "invalid-goal", message: "Check the cost, buffer, and contribution amounts." };
  }

  const base = projectBase(scenario, mods);
  const planGoal = { costCents, bufferCents };
  const affordableNow = isAffordableNow(base.days, planGoal);
  if (!base.paydays.length && !affordableNow) {
    return { ok: false, issue: "no-paycheck", message: "This scenario has no paycheck income, so there is nothing to set aside from." };
  }

  const maxCents = maxCandidateCents(scenario, costCents);
  const suggested = affordableNow ? 0 : suggestedContribution(base.days, base.paydays, planGoal, suggestedContributionCapCents(scenario, costCents));
  const limit = affordableNow ? 0 : contributionLimit(base.days, base.paydays, planGoal, maxCents);
  const inEffect = contributionCents ?? suggested;

  const { days, ...plan } = simulatePlan(base.days, base.paydays, planGoal, inEffect, bufferCents);
  return {
    ok: true,
    forecast: {
      asOfDate: base.asOfDate,
      horizonEndDate: base.horizonEndDate,
      suggestedContributionCents: suggested,
      limitContributionCents: limit,
      plan,
      days,
      funding: buildFunding(days, base.paydays, plan, costCents),
    },
  };
}

function isNonnegativeCents(value: Cents): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

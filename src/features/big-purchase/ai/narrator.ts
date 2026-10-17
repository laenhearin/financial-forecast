import { goalSummaryFacts } from "@/lib/ai/facts/goalSummary";
import { goalSummaryTemplate } from "@/lib/ai/fallbacks";
import type { AiSource, GoalSummaryResponse } from "@/lib/ai/types";
import type { AdviceResult, Forecast, Goal } from "../types";

export interface NarrationInput { goal: Goal; forecast: Forecast; advice: AdviceResult | null }
export interface AdviceNarrator { narrate(input: NarrationInput): Promise<string> }
export interface Narration { text: string; source: AiSource }

/** Default narrator: two or three templated sentences. No model is called. */
export const templateNarrator: AdviceNarrator = {
  async narrate({ goal, forecast, advice }) {
    return goalSummaryTemplate(goalSummaryFacts(goal.name, goal.costCents, goal.bufferCents, goal.preferredDeadline, forecast, advice));
  },
};

/**
 * AI narrator: asks the server for a model-written summary of the same engine results. The server
 * recomputes the forecast and advice from the goal inputs, so the model only words engine numbers.
 * Any failure falls back to the template text.
 */
export async function narrateWithAi(input: NarrationInput, signal?: AbortSignal): Promise<Narration> {
  const { goal } = input;
  try {
    const response = await fetch("/api/ai/goal-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: { name: goal.name, costCents: goal.costCents, bufferCents: goal.bufferCents, contributionCents: goal.contributionCents, deadline: goal.preferredDeadline },
      }),
      signal,
    });
    if (!response.ok) throw new Error(`Goal summary failed (${response.status}).`);
    const body = await response.json() as Partial<GoalSummaryResponse>;
    if (typeof body.summary !== "string" || !body.summary || !body.meta) throw new Error("Goal summary was empty.");
    return { text: body.summary, source: body.meta.source };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { text: await templateNarrator.narrate(input), source: "template" };
  }
}

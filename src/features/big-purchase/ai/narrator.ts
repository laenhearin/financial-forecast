import { formatDate } from "../../../lib/dates";
import { formatUSD } from "../../../lib/money";
import type { AdviceItem, AdviceResult, Forecast, Goal } from "../types";

export interface NarrationInput { goal: Goal; forecast: Forecast; advice: AdviceResult | null }
export interface AdviceNarrator { narrate(input: NarrationInput): Promise<string> }

/** Default narrator: two or three templated sentences. No model is called. */
export const templateNarrator: AdviceNarrator = {
  async narrate({ goal, forecast, advice }) {
    const item = friendlyName(goal.name);
    const { plan } = forecast;
    const sentences: string[] = [];

    if (plan.affordableNow) sentences.push(`You can afford ${item} right now and still keep ${formatUSD(goal.bufferCents)} in reserve.`);
    else if (plan.affordableDate) sentences.push(`At ${formatUSD(plan.contributionCents)} per paycheck you can afford ${item} on ${formatDate(plan.affordableDate, "long")}.`);
    else sentences.push(`At ${formatUSD(plan.contributionCents)} per paycheck, ${item} is not within reach in the next 24 months.`);

    if (advice && !advice.onTrack) {
      const top = advice.items[0];
      const target = goal.preferredDeadline ? `To reach your ${formatDate(goal.preferredDeadline, "long")} deadline` : "To get there sooner";
      if (!top) {
        sentences.push(`${target}, none of the available changes move the date on their own.`);
      } else {
        const effect = top.daysSooner !== null
          ? `which gets you there ${top.daysSooner} days sooner`
          : `which makes it affordable by ${formatDate(top.newAffordableDate!, "long")}`;
        sentences.push(`${target}, the biggest single change is ${actionPhrase(top)}, ${effect}.`);
        if (advice.items.length > 1 && advice.combined) {
          sentences.push(advice.combined.reachesDeadline
            ? `Combining ${advice.combined.itemIds.length === 1 ? "it" : `the top ${advice.combined.itemIds.length}`} reaches your deadline.`
            : `Even with every change, the earliest date is ${advice.combined.earliestDate ? formatDate(advice.combined.earliestDate, "long") : "beyond 24 months"}.`);
        }
      }
    } else if (advice?.onTrack) {
      sentences.push("You're on track for your deadline.");
    }
    return sentences.join(" ");
  },
};

export function getNarrator(): AdviceNarrator {
  return templateNarrator;
}

/** "Laptop" -> "your laptop"; names with inner capitals keep their casing. */
function friendlyName(name: string): string {
  const trimmed = name.trim() || "this";
  return /^[A-Z][a-z]*(?: [a-z]+)*$/.test(trimmed) ? `your ${trimmed.toLowerCase()}` : `your ${trimmed}`;
}

function actionPhrase(item: AdviceItem): string {
  const [verb, ...rest] = item.title.split(" ");
  const gerunds: Record<string, string> = { Set: "setting", Move: "moving", Cancel: "cancelling", Trim: "trimming" };
  return [gerunds[verb] ?? verb.toLowerCase(), ...rest].join(" ");
}

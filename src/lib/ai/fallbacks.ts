/**
 * Template text for every surface, built from the same facts the model gets. Pure and client-safe.
 * These read as normal product copy because users see them whenever the model is unavailable.
 */
import { HORIZON_MONTHS } from "@/features/big-purchase/config";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import type { AdvisorExplanation, AdvisorFacts, Baseline, GoalSummaryFacts } from "./types";

export function advisorTemplate(facts: AdvisorFacts): AdvisorExplanation {
  const { purchase, level, levelLabel, lowestWithPurchase: low, criticalBalanceCents } = facts;
  const what = `${purchase.label} (${formatUSD(purchase.amountCents)}) on ${formatDate(purchase.date, "short")}`;
  const lowText = `${formatUSD(low.cents)} on ${formatDate(low.date, "short")}`;
  const worse = facts.worsenedDayCount === 1 ? "1 day gets a worse balance level" : `${facts.worsenedDayCount} days get a worse balance level`;
  let explanation: string;
  if (level <= 1) {
    explanation = `Buying ${what} keeps your forecast ${levelLabel.toLowerCase()}. Your lowest balance afterward is ${lowText}, above your ${formatUSD(criticalBalanceCents)} critical balance.`;
  } else if (level === 2) {
    explanation = `Buying ${what} still works, but your cushion gets thinner: the lowest balance afterward is ${lowText}.${facts.worsenedDayCount ? ` ${worse}.` : ""}`;
  } else {
    explanation = `Buying ${what} takes your lowest balance to ${lowText}, which is ${levelLabel.toLowerCase()} for your ${formatUSD(criticalBalanceCents)} critical balance.${facts.worsenedDayCount ? ` ${worse}.` : ""}`;
  }
  return { headline: facts.recommendation, explanation, alternative: advisorAlternative(facts) };
}

function advisorAlternative(facts: AdvisorFacts): string | null {
  if (facts.level < 3) return null;
  if (facts.earliestSaferDate) return `Waiting until ${formatDate(facts.earliestSaferDate, "short")} would keep your forecast at caution or better.`;
  if (facts.nextPaycheck) return `Your next paycheck of ${formatUSD(facts.nextPaycheck.amountCents)} arrives ${formatDate(facts.nextPaycheck.date, "short")}; buying after it, or spending less, leaves more room.`;
  return "A smaller amount or a later date would leave more room for your bills.";
}

/** The Big Purchase summary. Matches the original template narrator's wording. */
export function goalSummaryTemplate(facts: GoalSummaryFacts): string {
  const item = friendlyName(facts.goalName);
  const contribution = formatUSD(facts.contributionPerPaycheckCents);
  const sentences: string[] = [];

  if (facts.affordableNow) sentences.push(`You can afford ${item} right now and still keep ${formatUSD(facts.bufferCents)} in reserve.`);
  else if (facts.affordableDate) sentences.push(`At ${contribution} per paycheck you can afford ${item} on ${formatDate(facts.affordableDate, "long")}.`);
  else sentences.push(`At ${contribution} per paycheck, ${item} is not within reach in the next ${HORIZON_MONTHS} months.`);

  if (facts.onTrack === false) {
    const top = facts.changes[0];
    const target = facts.deadline ? `To reach your ${formatDate(facts.deadline, "long")} deadline` : "To get there sooner";
    if (!top) {
      sentences.push(`${target}, none of the available changes move the date on their own.`);
    } else {
      const effect = top.daysSooner !== null
        ? `which gets you there ${top.daysSooner} days sooner`
        : `which makes it affordable by ${formatDate(top.newAffordableDate!, "long")}`;
      sentences.push(`${target}, the biggest single change is ${actionPhrase(top.title)}, ${effect}.`);
      const combined = facts.combined;
      if (combined && combined.reachesDeadline && combined.count > 1) {
        sentences.push(`Combining the top ${combined.count} reaches your deadline.`);
      } else if (combined && !combined.reachesDeadline && facts.changes.length > 1) {
        sentences.push(`Even with every change, the earliest date is ${combined.earliestDate ? formatDate(combined.earliestDate, "long") : `beyond ${HORIZON_MONTHS} months`}.`);
      }
    }
  } else if (facts.onTrack) {
    sentences.push("You're on track for your deadline.");
  }
  return sentences.join(" ");
}

/** "Laptop" -> "your laptop"; names with inner capitals keep their casing. */
function friendlyName(name: string): string {
  const trimmed = name.trim() || "this";
  return /^[A-Z][a-z]*(?: [a-z]+)*$/.test(trimmed) ? `your ${trimmed.toLowerCase()}` : `your ${trimmed}`;
}

function actionPhrase(title: string): string {
  const [verb, ...rest] = title.split(" ");
  const gerunds: Record<string, string> = { Set: "setting", Move: "moving", Cancel: "cancelling", Trim: "trimming" };
  return [gerunds[verb] ?? verb.toLowerCase(), ...rest].join(" ");
}

const AMOUNT_IN_QUESTION = /\$\s?\d|\d+\s?(dollars|bucks)/i;

/** A short overview from the baseline, for when the assistant can't answer. */
export function askTemplate(baseline: Baseline, question: string): string {
  const low = baseline.lowestBalance;
  const tight = baseline.days.filter((day) => !["THRIVING", "STABLE"].includes(day.level)).length;
  const sentences = [
    `Your balance is ${formatUSD(baseline.currentBalanceCents)} today.`,
    `The lowest point in the next ${baseline.horizonDays} days is ${formatUSD(low.cents)} on ${formatDate(low.date, "short")} (${low.level.toLowerCase()}).`,
    tight === 0
      ? "Every day in that stretch stays stable or better."
      : `${tight === 1 ? "1 day is" : `${tight} days are`} at caution or worse, measured against your ${formatUSD(baseline.criticalBalanceCents)} critical balance.`,
  ];
  const next = baseline.upcoming.find((item) => item.kind === "bill");
  if (next) sentences.push(`Next bill: ${next.label}, ${formatUSD(next.amountCents)} on ${formatDate(next.date, "short")}.`);
  if (AMOUNT_IN_QUESTION.test(question)) sentences.push("For a what-if on a specific purchase, try the Purchase Advisor.");
  return sentences.join(" ");
}

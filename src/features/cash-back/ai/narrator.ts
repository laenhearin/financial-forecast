import { formatUSD } from "../../../lib/money";
import { categoryNoun, formatRate } from "../format";
import type { AdviceFacts } from "./facts";

function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Default summary: a few templated sentences built only from the computed facts. No model is called. */
export function templateNarration(facts: AdviceFacts): string {
  const sentences: string[] = [];
  const period = `the last ${facts.windowDays} days`;

  if (facts.missedCents <= 0) {
    sentences.push(`In ${period} you used your best card for every purchase and earned ${formatUSD(facts.actualCents)} in rewards.`);
  } else {
    sentences.push(
      `In ${period} you earned ${formatUSD(facts.actualCents)} in rewards. The right card each time would have earned ${formatUSD(facts.bestCents)}, so you left ${formatUSD(facts.missedCents)} on the table, about ${formatUSD(facts.missedAnnualCents)} a year.`,
    );
  }

  const [first, second] = facts.topMisses;
  if (first) {
    const noun = categoryNoun(first.category);
    const missed = first.usedCardNames.length === 1 ? `and missed ${formatUSD(first.missedCents)}` : `missing ${formatUSD(first.missedCents)}`;
    const cards = first.usedCardNames.length === 1 ? joinNames(first.usedCardNames) : `${joinNames(first.usedCardNames)},`;
    sentences.push(
      `You spent ${formatUSD(first.spentCents)} on ${noun} with ${cards} ${missed}. Put ${noun} on ${first.betterCardName} (${formatRate(first.betterRateBps)}).`,
    );
  }
  if (second) {
    sentences.push(
      `${capitalize(categoryNoun(second.category))} on ${joinNames(second.usedCardNames)} cost you ${formatUSD(second.missedCents)}. ${second.betterCardName} pays ${formatRate(second.betterRateBps)} there.`,
    );
  }

  const tip = facts.suggestion;
  if (tip) {
    sentences.push(
      tip.annualFeeCents > 0
        ? `If you add one card, ${tip.cardName} would add about ${formatUSD(tip.gainAnnualCents)} a year, or ${formatUSD(tip.netAnnualCents)} after its ${formatUSD(tip.annualFeeCents)} annual fee.`
        : `If you add one card, ${tip.cardName} would add about ${formatUSD(tip.gainAnnualCents)} a year with no annual fee.`,
    );
  }
  return sentences.join(" ");
}

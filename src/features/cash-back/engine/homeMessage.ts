import { formatDate } from "../../../lib/dates";
import { findCard } from "../cards/catalog";
import {
  brandedName, CATEGORY_SHORT_LABELS, categoryNoun, formatRate, formatWholeDollars, formatYearlyGain, joinWords,
} from "../format";
import type { CategoryId } from "../types";
import type { WalletAnalysis } from "./analyze";

export type HomeMessage =
  | { kind: "rotating"; cardId: string; category: CategoryId; title: string; body: string; figure: string }
  | { kind: "suggestion"; cardId: string; title: string; body: string; figure: string }
  | { kind: "working"; title: string; body: string; figure: string };

/**
 * The homepage cash back card. First match wins:
 * 1. An owned card wins a category with spend through an active rotating bonus (largest spend first).
 * 2. There is a card worth adding.
 * 3. Otherwise, the yearly rewards from the cards the user has.
 */
export function homeMessage(analysis: WalletAnalysis): HomeMessage {
  const rotating = analysis.winners
    .filter(item => item.winner?.source === "rotating" && item.monthlySpendCents > 0)
    .sort((a, b) => b.monthlySpendCents - a.monthlySpendCents)[0];
  const rotatingCard = rotating?.winner ? findCard(rotating.winner.cardId) : undefined;
  if (rotating?.winner && rotatingCard?.rotating) {
    const { rateBps, capRemainingCents } = rotating.winner;
    return {
      kind: "rotating",
      cardId: rotatingCard.id,
      category: rotating.category,
      title: `Use ${brandedName(rotatingCard)} for ${categoryNoun(rotating.category)}`,
      body: `${formatRate(rateBps)} back through ${formatDate(rotatingCard.rotating.endDate, "short")}. Bonus room left this quarter shown below.`,
      figure: `${formatWholeDollars(capRemainingCents ?? 0)} left at ${formatRate(rateBps)}`,
    };
  }

  const suggestion = analysis.suggestions[0];
  const suggestedCard = suggestion ? findCard(suggestion.cardId) : undefined;
  if (suggestion && suggestedCard) {
    const categories = suggestion.takesOver.slice(0, 2).map(category => CATEGORY_SHORT_LABELS[category]);
    return {
      kind: "suggestion",
      cardId: suggestedCard.id,
      title: `Add ${brandedName(suggestedCard)}?`,
      body: categories.length ? `Takes over ${joinWords(categories)}.` : "Adds to what your cards earn.",
      figure: formatYearlyGain(suggestion.netGainCents),
    };
  }

  const covered = analysis.winners.filter(item => item.winner && item.monthlySpendCents > 0).length;
  return {
    kind: "working",
    title: "Your cards are working",
    body: `Best card set for ${covered} ${covered === 1 ? "category" : "categories"}.`,
    figure: `${formatWholeDollars(analysis.projection.totalCents)}/yr`,
  };
}

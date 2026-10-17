import { HIGH_FEE_CLEAR_WIN_CENTS, HIGH_FEE_THRESHOLD_CENTS } from "../config";
import type { CardDefinition, CategorizedPurchase, Category, Cents, ISODate, NewCardSuggestion, SuggestionResult } from "../types";
import { annualizeCents, computeRewards } from "./rewards";

export interface SuggestOptions {
  /** Start of the scoring window (inclusive). Earlier purchases only warm up the cap ledgers. */
  from: ISODate;
  windowDays: number;
  findCard: (id: string) => CardDefinition | undefined;
}

/**
 * Simulates each library card the user does not own against their real spending and returns the one
 * with the largest net yearly value (added rewards minus the annual fee). A card must add more than it
 * costs. High-fee cards are suggested only when they beat the best low-fee card by a clear margin.
 */
export function suggestNewCard(
  purchases: readonly CategorizedPurchase[],
  selectedCards: readonly CardDefinition[],
  library: readonly CardDefinition[],
  options: SuggestOptions,
): SuggestionResult {
  const { from, windowDays, findCard } = options;
  const owned = new Set(selectedCards.map(card => card.id));
  const baseline = computeRewards(purchases, selectedCards, { from, findCard });
  const baselineById = new Map(baseline.scored.map(item => [item.purchase.id, item.best.rewardCents]));

  const evaluated: NewCardSuggestion[] = library
    .filter(card => !owned.has(card.id))
    .map(card => {
      const withCard = computeRewards(purchases, [...selectedCards, card], { from, findCard });
      const gainWindowCents = withCard.bestCents - baseline.bestCents;
      const byCategory = new Map<Category, Cents>();
      for (const item of withCard.scored) {
        if (item.best.cardId !== card.id) continue;
        const gain = item.best.rewardCents - (baselineById.get(item.purchase.id) ?? 0);
        if (gain > 0) byCategory.set(item.purchase.category, (byCategory.get(item.purchase.category) ?? 0) + gain);
      }
      const gainAnnualCents = annualizeCents(gainWindowCents, windowDays);
      return {
        cardId: card.id,
        cardName: card.name,
        annualFeeCents: card.annualFeeCents,
        isHighFee: card.annualFeeCents >= HIGH_FEE_THRESHOLD_CENTS,
        gainWindowCents,
        gainAnnualCents,
        netAnnualCents: gainAnnualCents - card.annualFeeCents,
        topCategories: [...byCategory]
          .map(([category, gain]) => ({ category, gainWindowCents: gain }))
          .sort((a, b) => b.gainWindowCents - a.gainWindowCents),
      };
    });

  const order = new Map(library.map((card, index) => [card.id, index]));
  const rank = (a: NewCardSuggestion, b: NewCardSuggestion) =>
    b.netAnnualCents - a.netAnnualCents || a.annualFeeCents - b.annualFeeCents || order.get(a.cardId)! - order.get(b.cardId)!;
  const worthwhile = evaluated.filter(item => item.gainWindowCents > 0 && item.netAnnualCents > 0).sort(rank);
  const bestLowFee = worthwhile.find(item => !item.isHighFee) ?? null;
  const bestHighFee = worthwhile.find(item => item.isHighFee) ?? null;

  const highFeeWins = bestHighFee !== null && bestHighFee.netAnnualCents >= (bestLowFee?.netAnnualCents ?? 0) + HIGH_FEE_CLEAR_WIN_CENTS;
  const suggestion = highFeeWins ? bestHighFee : bestLowFee;
  const skippedHighFee = evaluated
    .filter(item => item.isHighFee && item.gainWindowCents > 0 && item !== suggestion)
    .sort(rank)
    .map(({ cardId, cardName, annualFeeCents, gainAnnualCents, netAnnualCents }) => ({ cardId, cardName, annualFeeCents, gainAnnualCents, netAnnualCents }));
  return { suggestion, skippedHighFee };
}

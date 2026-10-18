import { cardsByIds, findCard } from "../cards/catalog";
import { CATEGORY_IDS, type Bps, type CategoryId, type Cents, type CreditCard, type ISODate, type Selections, type SpendProfile } from "../types";
import { evaluateCard, PROJECTION_MONTHS, projectWalletRewards } from "./rewards";

// Side-by-side comparison of up to three catalog cards on the user's own spending. Pure and
// deterministic: the page and the AI overview route both call compareCards with the same inputs.

export const MAX_COMPARE_CARDS = 3;
const TOP_CATEGORY_COUNT = 3;

export interface ComparedCard {
  cardId: string;
  /** Yearly rewards if this were the only card used for all spending, before the annual fee. */
  yearlyRewardsCents: Cents;
  annualFeeCents: Cents;
  /** yearlyRewardsCents minus the annual fee. */
  netCents: Cents;
  /** Cash-equivalent return on a year of spending; null when the profile has no spending. */
  returnBps: Bps | null;
  /** Categories that earn the most on this card, biggest reward first. */
  topCategories: CategoryId[];
  owned: boolean;
  /** Net yearly gain from adding this card to the user's current cards; null for a card they have. */
  addedNetCents: Cents | null;
}

export interface CompareRow {
  category: CategoryId;
  monthlySpendCents: Cents;
  /** Yearly rewards in this category, one entry per compared card, in the same order. */
  rewardCents: Cents[];
  /** Cards that earn the most here; empty with fewer than two cards or when nothing earns. */
  bestCardIds: string[];
}

export interface CardComparison {
  /** In the order the user picked them. */
  cards: ComparedCard[];
  /** Categories with spending, most spending first. */
  rows: CompareRow[];
  yearlySpendCents: Cents;
  /** Most left after the annual fee; null with fewer than two cards. */
  bestCardId: string | null;
  /** Second by the same ranking; null with fewer than two cards. */
  runnerUpCardId: string | null;
  /** How far the best card is ahead of the next one, after fees; null with fewer than two cards. */
  marginCents: Cents | null;
}

export interface CompareInput {
  cardIds: readonly string[];
  ownedCardIds: readonly string[];
  spendProfile: SpendProfile;
  today: ISODate;
  selections?: Selections;
}

/** Known, distinct ids in the order given, at most MAX_COMPARE_CARDS. */
export function compareCardList(cardIds: readonly string[]): CreditCard[] {
  const cards: CreditCard[] = [];
  for (const id of cardIds) {
    const card = findCard(id);
    if (card && !cards.includes(card) && cards.length < MAX_COMPARE_CARDS) cards.push(card);
  }
  return cards;
}

/** Ranking for "best for you": most left after the fee, then the lower fee, then the more popular card. */
function isAhead(a: { card: CreditCard; netCents: Cents }, b: { card: CreditCard; netCents: Cents }): boolean {
  if (a.netCents !== b.netCents) return a.netCents > b.netCents;
  if (a.card.annualFeeCents !== b.card.annualFeeCents) return a.card.annualFeeCents < b.card.annualFeeCents;
  return a.card.popularityRank < b.card.popularityRank;
}

export function compareCards({ cardIds, ownedCardIds, spendProfile, today, selections }: CompareInput): CardComparison {
  const cards = compareCardList(cardIds);
  const options = { selections };
  const owned = cardsByIds(ownedCardIds);
  const ownedIds = new Set(owned.map(card => card.id));
  const baseline = projectWalletRewards(owned, spendProfile, today, options);
  const monthlySpendCents = CATEGORY_IDS.reduce((sum, category) => sum + (spendProfile[category] ?? 0), 0);
  const yearlySpendCents = monthlySpendCents * PROJECTION_MONTHS;

  const projections = cards.map(card => projectWalletRewards([card], spendProfile, today, options));
  const compared: ComparedCard[] = cards.map((card, index) => {
    const projection = projections[index];
    const isOwned = ownedIds.has(card.id);
    return {
      cardId: card.id,
      yearlyRewardsCents: projection.totalCents,
      annualFeeCents: card.annualFeeCents,
      netCents: projection.totalCents - card.annualFeeCents,
      returnBps: yearlySpendCents > 0 ? Math.round((projection.totalCents * 10_000) / yearlySpendCents) : null,
      topCategories: projection.categories
        .filter(item => item.rewardCents > 0)
        // Stable sort keeps the bigger-spend category first on equal rewards.
        .sort((a, b) => b.rewardCents - a.rewardCents)
        .slice(0, TOP_CATEGORY_COUNT)
        .map(item => item.category),
      owned: isOwned,
      addedNetCents: isOwned ? null : evaluateCard(owned, card, spendProfile, today, options, baseline).netGainCents,
    };
  });

  const rewardsByCategory = projections.map(projection => new Map(projection.categories.map(item => [item.category, item.rewardCents])));
  const rows: CompareRow[] = CATEGORY_IDS
    .map((category, order) => ({ category, order, monthlySpendCents: spendProfile[category] ?? 0 }))
    .filter(item => item.monthlySpendCents > 0)
    .sort((a, b) => b.monthlySpendCents - a.monthlySpendCents || a.order - b.order)
    .map(({ category, monthlySpendCents: spend }) => {
      const rewardCents = rewardsByCategory.map(rewards => rewards.get(category) ?? 0);
      const top = Math.max(0, ...rewardCents);
      const bestCardIds = cards.length >= 2 && top > 0 ? cards.filter((_, index) => rewardCents[index] === top).map(card => card.id) : [];
      return { category, monthlySpendCents: spend, rewardCents, bestCardIds };
    });

  let bestCardId: string | null = null;
  let runnerUpCardId: string | null = null;
  let marginCents: Cents | null = null;
  if (cards.length >= 2) {
    const ranked = cards
      .map((card, index) => ({ card, netCents: compared[index].netCents }))
      .sort((a, b) => (isAhead(a, b) ? -1 : isAhead(b, a) ? 1 : 0));
    bestCardId = ranked[0].card.id;
    runnerUpCardId = ranked[1].card.id;
    marginCents = ranked[0].netCents - ranked[1].netCents;
  }

  return { cards: compared, rows, yearlySpendCents, bestCardId, runnerUpCardId, marginCents };
}

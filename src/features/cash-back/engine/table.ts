import { CATEGORY_LABELS, CATEGORY_SHORT_LABELS, effectiveBps, ISSUER_LABELS } from "../format";
import { CATEGORY_IDS, ISSUERS, type Bps, type CategoryId, type CreditCard, type ISODate } from "../types";
import { getEffectiveRate, ruleCategory, type GoldCard, type RateContext } from "./rewards";

export type SortMode = "issuer" | "popularity";
export type OwnershipFilter = "all" | "mine" | "not_owned";

export interface TableQuery {
  search: string;
  sort: SortMode;
  ownership: OwnershipFilter;
  showBusiness: boolean;
}

/** Categories a card has any rule for (category, rotating, or selectable). */
export function rewardedCategories(card: CreditCard): CategoryId[] {
  const mentioned = new Set<CategoryId>([
    ...card.categoryRules.map(rule => rule.category),
    ...(Object.keys(card.rotating?.rates ?? {}) as CategoryId[]),
    ...(card.selectable?.options ?? []),
  ]);
  return CATEGORY_IDS.filter(category => mentioned.has(category));
}

/** Case-insensitive match on name, full name, issuer, and the labels of categories the card rewards. */
export function matchesSearch(card: CreditCard, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    card.name, card.fullName, card.issuer, ISSUER_LABELS[card.issuer],
    ...rewardedCategories(card).flatMap(category => [CATEGORY_LABELS[category], CATEGORY_SHORT_LABELS[category]]),
  ].join(" | ").toLowerCase();
  return haystack.includes(term);
}

export interface TableGroup {
  id: string;
  /** Label row text; null for an unlabeled run of rows (Popularity sort). */
  label: string | null;
  cards: CreditCard[];
}

const ISSUER_ORDER = new Map<string, number>(ISSUERS.map((issuer, index) => [issuer, index]));

function compareBy(sort: SortMode) {
  return (a: CreditCard, b: CreditCard) =>
    (sort === "issuer" ? ISSUER_ORDER.get(a.issuer)! - ISSUER_ORDER.get(b.issuer)! : 0) || a.popularityRank - b.popularityRank;
}

/**
 * Rows for the card table, in order: gold cards (owned and best for a category, by the monthly spend
 * they win), then other owned cards, then everything else, each in the chosen sort. Issuer sort labels
 * the owned groups and one group per issuer. Unowned business cards are hidden unless asked for.
 */
export function buildTable(catalog: readonly CreditCard[], ownedIds: ReadonlySet<string>, gold: readonly GoldCard[], query: TableQuery): TableGroup[] {
  const goldOrder = new Map(gold.map((item, index) => [item.cardId, index]));
  const compare = compareBy(query.sort);
  const visible = catalog.filter(card => {
    const owned = ownedIds.has(card.id);
    if (query.ownership === "mine" && !owned) return false;
    if (query.ownership === "not_owned" && owned) return false;
    if (card.isBusiness && !owned && !query.showBusiness) return false;
    return matchesSearch(card, query.search);
  });
  const pinned = visible.filter(card => goldOrder.has(card.id) && ownedIds.has(card.id)).sort((a, b) => goldOrder.get(a.id)! - goldOrder.get(b.id)!);
  const otherOwned = visible.filter(card => ownedIds.has(card.id) && !goldOrder.has(card.id)).sort(compare);
  const rest = visible.filter(card => !ownedIds.has(card.id)).sort(compare);

  const groups: TableGroup[] = query.sort === "popularity"
    ? [{ id: "all", label: null, cards: [...pinned, ...otherOwned, ...rest] }]
    : [
      { id: "best", label: "Your best cards", cards: pinned },
      { id: "owned", label: "Your other cards", cards: otherOwned },
      ...ISSUERS.map(issuer => ({ id: issuer, label: ISSUER_LABELS[issuer], cards: rest.filter(card => card.issuer === issuer) })),
    ];
  return groups.filter(group => group.cards.length > 0);
}

export interface RateChip {
  category: CategoryId;
  rateBps: Bps;
  rotating: boolean;
}

/**
 * The card's highest bonus rates today, ignoring cap use: "5% Utilities", "3% Dining". Rotating rates
 * count only while active; selectable cards show their chosen categories. Amazon is left out when it
 * only falls back to online shopping, so the same rule isn't shown twice.
 */
export function topRateChips(card: CreditCard, ctx: RateContext & { today: ISODate }, limit = 3): RateChip[] {
  const baseBps = effectiveBps(card.baseRate, card);
  return CATEGORY_IDS
    .filter(category => category !== "other" && ruleCategory(card, category) === category)
    .map((category, order) => ({ category, order, rate: getEffectiveRate(card, category, { ...ctx, ledger: undefined }) }))
    .filter(item => item.rate.source !== "base" && item.rate.rateBps > baseBps)
    .sort((a, b) => b.rate.rateBps - a.rate.rateBps || Number(b.rate.source === "rotating") - Number(a.rate.source === "rotating") || a.order - b.order)
    .slice(0, limit)
    .map(item => ({ category: item.category, rateBps: item.rate.rateBps, rotating: item.rate.source === "rotating" }));
}

import { CATEGORIES, type CardDefinition, type CardOption, type CategorizedPurchase, type Category, type Cents, type ISODate, type PlaybookEntry } from "../types";
import { bestCardForPurchase, headlineRateBps, tierFor, type CapLedger } from "./rewards";

/** Selected cards ranked by advertised rate for a category; ties go to the lower fee, then input order. */
function rankByRate(cards: readonly CardDefinition[], category: Category) {
  return cards
    .map((card, order) => ({ card, rateBps: headlineRateBps(card, category), order }))
    .sort((a, b) => b.rateBps - a.rateBps || a.card.annualFeeCents - b.card.annualFeeCents || a.order - b.order);
}

/**
 * The best card for each category. When the best card's rate is capped, the entry shows the cap room
 * left in the current period (from actual spending in `ledger`) and the card that takes over after it.
 * Categories with spending come first, largest first.
 */
export function buildPlaybook(
  selectedCards: readonly CardDefinition[],
  windowPurchases: readonly CategorizedPurchase[],
  asOfDate: ISODate,
  ledger: CapLedger,
): PlaybookEntry[] {
  if (selectedCards.length === 0) return [];
  const spend = new Map<Category, Cents>();
  for (const purchase of windowPurchases) spend.set(purchase.category, (spend.get(purchase.category) ?? 0) + purchase.amountCents);

  const entries = CATEGORIES.map((category): PlaybookEntry => {
    const ranked = rankByRate(selectedCards, category);
    const top = ranked[0];
    const primary = { cardId: top.card.id, cardName: top.card.name, rateBps: top.rateBps };
    const found = tierFor(top.card, category);
    if (!found?.tier.cap) return { category, spendCents: spend.get(category) ?? 0, primary, cap: null, fallback: null };

    const { amountCents, period } = found.tier.cap;
    const remainingCents = Math.max(0, amountCents - ledger.used(top.card.id, found.index, asOfDate, period));
    // After the cap the primary card earns its base rate; the next-best card takes over if it pays more.
    const after = [{ card: top.card, rateBps: top.card.baseRateBps }, ...ranked.slice(1)]
      .sort((a, b) => b.rateBps - a.rateBps)[0];
    const fallback = after.card.id === top.card.id ? null : { cardId: after.card.id, cardName: after.card.name, rateBps: after.rateBps };
    return { category, spendCents: spend.get(category) ?? 0, primary, cap: { amountCents, period, remainingCents, afterCapRateBps: after.rateBps }, fallback };
  });

  const order = new Map(CATEGORIES.map((category, index) => [category, index]));
  return entries.sort((a, b) => b.spendCents - a.spendCents || order.get(a.category)! - order.get(b.category)!);
}

export interface LookupResult {
  best: CardOption;
  /** The next-best card, when there is one. */
  runnerUp: CardOption | null;
  /** Cap room on the best card after this purchase; null when that rate has no cap. */
  capRemainingAfterCents: Cents | null;
}

/** "Which card should I use?" for one purchase today, using cap room left from actual spending. */
export function lookupPurchase(
  query: { category: Category; amountCents: Cents },
  selectedCards: readonly CardDefinition[],
  ledger: CapLedger,
  asOfDate: ISODate,
): LookupResult | null {
  if (query.amountCents <= 0) return null;
  const ranked = bestCardForPurchase({ ...query, date: asOfDate }, selectedCards, ledger);
  if (ranked.length === 0) return null;
  const best = ranked[0];
  return {
    best,
    runnerUp: ranked[1] ?? null,
    capRemainingAfterCents: best.capRemainingCents === null ? null : Math.max(0, best.capRemainingCents - query.amountCents),
  };
}

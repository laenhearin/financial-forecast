import { dateParts } from "../../../lib/dates";
import type {
  BonusTier, Bps, CapPeriod, CardDefinition, CardOption, CategorizedPurchase, Category, Cents, ISODate,
  RewardsResult, ScoredPurchase, WrongCardFlag,
} from "../types";

/** "2026-10" for monthly caps, "2026-Q4" for quarterly caps (calendar quarters, UTC dates). */
export function periodKey(date: ISODate, period: CapPeriod): string {
  const { year, month } = dateParts(date);
  return period === "monthly" ? `${year}-${String(month).padStart(2, "0")}` : `${year}-Q${Math.ceil(month / 3)}`;
}

/** The highest-rate bonus tier covering this category, ignoring tiers that pay no more than the base rate. */
export function tierFor(card: CardDefinition, category: Category): { tier: BonusTier; index: number } | null {
  let found: { tier: BonusTier; index: number } | null = null;
  for (let index = 0; index < card.tiers.length; index++) {
    const tier = card.tiers[index];
    if (tier.categories.includes(category) && tier.rateBps > card.baseRateBps && (!found || tier.rateBps > found.tier.rateBps)) {
      found = { tier, index };
    }
  }
  return found;
}

/** The advertised rate for a category, before any cap. */
export function headlineRateBps(card: CardDefinition, category: Category): Bps {
  return tierFor(card, category)?.tier.rateBps ?? card.baseRateBps;
}

/** Spending recorded against capped tiers, per card, tier, and cap period. */
export class CapLedger {
  private readonly spent = new Map<string, Cents>();

  private static key(cardId: string, tierIndex: number, period: string): string {
    return `${cardId}|${tierIndex}|${period}`;
  }

  /** Amount already spent in the tier's cap period that contains `date`. */
  used(cardId: string, tierIndex: number, date: ISODate, period: CapPeriod): Cents {
    return this.spent.get(CapLedger.key(cardId, tierIndex, periodKey(date, period))) ?? 0;
  }

  /** Records a purchase on a card. Only capped tiers are tracked. */
  record(card: CardDefinition, category: Category, amountCents: Cents, date: ISODate): void {
    const found = tierFor(card, category);
    if (!found?.tier.cap) return;
    const key = CapLedger.key(card.id, found.index, periodKey(date, found.tier.cap.period));
    this.spent.set(key, (this.spent.get(key) ?? 0) + amountCents);
  }
}

/** Reward in cents, rounded once to the nearest cent from an integer numerator. */
function rewardCents(amountCents: Cents, rateBps: Bps): Cents {
  return Math.round((amountCents * rateBps) / 10_000);
}

/** What one card earns on a purchase, given the cap room left. Spending above the cap earns the base rate. */
export function scoreCard(card: CardDefinition, category: Category, amountCents: Cents, date: ISODate, ledger: CapLedger): CardOption {
  const base = { cardId: card.id, cardName: card.name };
  const found = tierFor(card, category);
  if (!found) {
    return { ...base, rewardCents: rewardCents(amountCents, card.baseRateBps), rateBps: card.baseRateBps, capped: false, capRemainingCents: null, capPeriod: null };
  }
  const { tier, index } = found;
  if (!tier.cap) {
    return { ...base, rewardCents: rewardCents(amountCents, tier.rateBps), rateBps: tier.rateBps, capped: false, capRemainingCents: null, capPeriod: null };
  }
  const remaining = Math.max(0, tier.cap.amountCents - ledger.used(card.id, index, date, tier.cap.period));
  const bonusPart = Math.min(amountCents, remaining);
  const reward = Math.round((bonusPart * tier.rateBps + (amountCents - bonusPart) * card.baseRateBps) / 10_000);
  return { ...base, rewardCents: reward, rateBps: tier.rateBps, capped: bonusPart < amountCents, capRemainingCents: remaining, capPeriod: tier.cap.period };
}

export interface PurchaseQuery { category: Category; amountCents: Cents; date: ISODate }

/**
 * Ranks cards for one purchase by the reward they would earn right now, using each card's category
 * rate and remaining cap. When a card's cap is used up it earns its base rate, so the next-best card
 * rises to the top. Ties go to the card without a cap hit, then the lower annual fee, then input order.
 * Returns an empty list when there are no cards.
 */
export function bestCardForPurchase(query: PurchaseQuery, cards: readonly CardDefinition[], ledger: CapLedger): CardOption[] {
  const fees = new Map(cards.map((card, order) => [card.id, { fee: card.annualFeeCents, order }]));
  return cards
    .map(card => scoreCard(card, query.category, query.amountCents, query.date, ledger))
    .sort((a, b) =>
      b.rewardCents - a.rewardCents
      || Number(a.capped) - Number(b.capped)
      || fees.get(a.cardId)!.fee - fees.get(b.cardId)!.fee
      || fees.get(a.cardId)!.order - fees.get(b.cardId)!.order);
}

function byDateThenId(a: CategorizedPurchase, b: CategorizedPurchase): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface RewardsOptions {
  /** Every purchase updates the cap ledgers, but only purchases on or after this date are scored and totaled. */
  from?: ISODate;
  /** Looks up the card actually used. Defaults to searching `selectedCards`. */
  findCard?: (id: string) => CardDefinition | undefined;
}

/**
 * Scores every purchase twice, in date order: once with the card actually used and once with the best
 * card (the playbook). Each scenario keeps its own cap ledger. The best-card candidates are the selected
 * cards plus the card actually used, since the user evidently had it at the time.
 */
export function computeRewards(purchases: readonly CategorizedPurchase[], selectedCards: readonly CardDefinition[], options: RewardsOptions = {}): RewardsResult {
  const find = options.findCard ?? ((id: string) => selectedCards.find(card => card.id === id));
  const actualLedger = new CapLedger();
  const bestLedger = new CapLedger();
  const scored: ScoredPurchase[] = [];
  let actualCents = 0;
  let bestCents = 0;
  let capAdjustmentCents = 0;

  for (const purchase of [...purchases].sort(byDateThenId)) {
    const usedCard = find(purchase.cardId);
    if (!usedCard) throw new Error(`Purchase ${purchase.id} uses an unknown card "${purchase.cardId}".`);
    const { category, amountCents, date } = purchase;

    const actual = scoreCard(usedCard, category, amountCents, date, actualLedger);
    actualLedger.record(usedCard, category, amountCents, date);

    const candidates = selectedCards.some(card => card.id === usedCard.id) ? selectedCards : [...selectedCards, usedCard];
    const ranked = bestCardForPurchase({ category, amountCents, date }, candidates, bestLedger);
    // On a tie, keep the card the user actually used so it isn't flagged.
    const best = ranked.find(option => option.cardId === usedCard.id && option.rewardCents === ranked[0].rewardCents) ?? ranked[0];
    bestLedger.record(candidates.find(card => card.id === best.cardId)!, category, amountCents, date);

    if (options.from && date < options.from) continue;
    scored.push({ purchase, actual, best, missedCents: best.rewardCents - actual.rewardCents });
    actualCents += actual.rewardCents;
    bestCents += best.rewardCents;
    capAdjustmentCents += Math.min(0, best.rewardCents - actual.rewardCents);
  }
  return { scored, actualCents, bestCents, missedCents: bestCents - actualCents, capAdjustmentCents };
}

/** Purchases where another card would have earned more, biggest misses first. */
export function flagWrongCardPurchases(result: RewardsResult): WrongCardFlag[] {
  return result.scored
    .filter(item => item.missedCents > 0 && item.best.cardId !== item.actual.cardId)
    .map(({ purchase, actual, best, missedCents }) => ({
      purchaseId: purchase.id,
      date: purchase.date,
      merchant: purchase.merchant,
      category: purchase.category,
      amountCents: purchase.amountCents,
      usedCardId: actual.cardId,
      usedCardName: actual.cardName,
      usedRateBps: actual.rateBps,
      betterCardId: best.cardId,
      betterCardName: best.cardName,
      betterRateBps: best.rateBps,
      missedCents,
    }))
    .sort((a, b) => b.missedCents - a.missedCents || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.purchaseId < b.purchaseId ? -1 : 1));
}

/** Replays actual card usage to find how much cap room is left as of the last purchase. */
export function actualCapLedger(purchases: readonly CategorizedPurchase[], findCard: (id: string) => CardDefinition | undefined): CapLedger {
  const ledger = new CapLedger();
  for (const purchase of [...purchases].sort(byDateThenId)) {
    const card = findCard(purchase.cardId);
    if (card) ledger.record(card, purchase.category, purchase.amountCents, purchase.date);
  }
  return ledger;
}

/** Scales a window total to a year: cents * 365 / days, rounded to the nearest cent. */
export function annualizeCents(cents: Cents, windowDays: number): Cents {
  if (!Number.isSafeInteger(windowDays) || windowDays <= 0) throw new Error("Window must be a positive whole number of days.");
  return Math.round((cents * 365) / windowDays);
}

import { addMonths, clampedDate, dateParts, daysInMonth } from "../../../lib/dates";
import { effectiveBps } from "../format";
import {
  CATEGORY_IDS, isCategoryId,
  type Bps, type CapPeriod, type CategoryId, type Cents, type CreditCard, type ISODate, type Issuer,
  type SelectableCategory, type Selections, type SpendCap, type SpendProfile,
} from "../types";

// Pure reward math for the Cash Back page. Money is integer cents, rates are basis points of cash
// value, and "today" is always passed in, so every result is deterministic.

export type RateSource = "rotating" | "selectable" | "category" | "base";

/** Calendar period containing `date`: "2026-10", "2026-Q4", or "2026". */
export function periodKey(date: ISODate, period: CapPeriod): string {
  const { year, month } = dateParts(date);
  if (period === "month") return `${year}-${String(month).padStart(2, "0")}`;
  return period === "quarter" ? `${year}-Q${Math.ceil(month / 3)}` : String(year);
}

/** One spending limit on one card. Caps that cover the same categories share a pool. */
export interface CapPool {
  key: string;
  cap: SpendCap;
}

function poolFor(card: CreditCard, covers: readonly CategoryId[], cap: SpendCap): CapPool {
  return { key: `${card.id}|${[...new Set(covers)].sort().join(",")}`, cap };
}

/** Spend recorded against each cap pool, per calendar period. */
export class CapLedger {
  private readonly spent = new Map<string, Cents>();

  private static key(pool: CapPool, date: ISODate): string {
    return `${pool.key}|${periodKey(date, pool.cap.period)}`;
  }

  used(pool: CapPool, date: ISODate): Cents {
    return this.spent.get(CapLedger.key(pool, date)) ?? 0;
  }

  remaining(pool: CapPool, date: ISODate): Cents {
    return Math.max(0, pool.cap.amountCents - this.used(pool, date));
  }

  add(pool: CapPool, date: ISODate, cents: Cents): void {
    const key = CapLedger.key(pool, date);
    this.spent.set(key, (this.spent.get(key) ?? 0) + cents);
  }
}

export interface RateContext {
  today: ISODate;
  /** Spend already used against each cap this period. Empty when omitted. */
  ledger?: CapLedger;
  /** Chosen bonus categories for user_choice cards; defaults apply when missing or invalid. */
  selections?: Selections;
  /** Monthly spend, which decides auto_top_spend categories (Citi Custom Cash). */
  spendProfile?: SpendProfile;
}

export interface EffectiveRate {
  cardId: string;
  /** Cash-equivalent rate for the next dollar: earn rate × point value, in basis points. */
  rateBps: Bps;
  /** Which rule won, so the UI can explain it. */
  source: RateSource;
  /** Room left at this rate this period; null when the rate has no cap. */
  capRemainingCents: Cents | null;
  /** The cap this rate draws down; null when uncapped. */
  pool: CapPool | null;
}

/** Amazon counts as online shopping on a card with no Amazon rule. No other category falls back. */
export function ruleCategory(card: CreditCard, category: CategoryId): CategoryId {
  if (category !== "amazon") return category;
  const hasAmazonRule = card.categoryRules.some(rule => rule.category === "amazon")
    || card.rotating?.rates.amazon !== undefined
    || card.selectable?.options.includes("amazon") === true;
  return hasAmazonRule ? "amazon" : "online_shopping";
}

/** True when `choice` is a complete, valid pick for this selectable block. */
export function isValidChoice(block: SelectableCategory, choice: readonly unknown[]): choice is CategoryId[] {
  return choice.length === block.picks
    && new Set(choice).size === choice.length
    && choice.every(category => isCategoryId(category) && block.options.includes(category));
}

/**
 * The bonus categories in effect on a selectable card. auto_top_spend: the options with the highest
 * spend in the profile (ties keep option order). user_choice: the stored choice, else the defaults.
 */
export function chosenCategories(card: CreditCard, ctx: Pick<RateContext, "selections" | "spendProfile">): CategoryId[] {
  const block = card.selectable;
  if (!block) return [];
  if (block.mode === "auto_top_spend") {
    const profile = ctx.spendProfile;
    if (!profile) return [...block.defaultChoices];
    return block.options
      .map((category, order) => ({ category, order, spend: profile[category] ?? 0 }))
      .sort((a, b) => b.spend - a.spend || a.order - b.order)
      .slice(0, block.picks)
      .map(item => item.category);
  }
  const stored = ctx.selections?.[card.id];
  return stored && isValidChoice(block, stored) ? [...stored] : [...block.defaultChoices];
}

const SOURCE_ORDER: Record<RateSource, number> = { rotating: 0, selectable: 1, category: 2, base: 3 };

/** Within one card: higher rate, then the uncapped rate (saves cap room), then the more specific rule. */
function isBetterTier(a: EffectiveRate, b: EffectiveRate): boolean {
  if (a.rateBps !== b.rateBps) return a.rateBps > b.rateBps;
  const capped = Number(a.pool !== null) - Number(b.pool !== null);
  return capped !== 0 ? capped < 0 : SOURCE_ORDER[a.source] < SOURCE_ORDER[b.source];
}

/**
 * The rate one card earns on the next dollar in a category on `ctx.today`. Collects every rule that
 * applies (rotating while in its date range, chosen selectable categories, the category rule, the base
 * rate), drops capped rules whose cap is used up (or swaps in rateAfterCap), and takes the highest.
 */
export function getEffectiveRate(card: CreditCard, category: CategoryId, ctx: RateContext): EffectiveRate {
  const lookup = ruleCategory(card, category);
  const tiers: { rate: number; source: RateSource; pool: CapPool | null }[] = [{ rate: card.baseRate, source: "base", pool: null }];

  for (const rule of card.categoryRules) {
    if (rule.category !== lookup) continue;
    tiers.push({ rate: rule.rate, source: "category", pool: rule.cap ? poolFor(card, [rule.category, ...(rule.cap.sharedWith ?? [])], rule.cap) : null });
  }
  const selectable = card.selectable;
  if (selectable && chosenCategories(card, ctx).includes(lookup)) {
    const pool = selectable.cap ? poolFor(card, [...selectable.options, ...(selectable.cap.sharedWith ?? [])], selectable.cap) : null;
    tiers.push({ rate: selectable.rate, source: "selectable", pool });
  }
  const rotating = card.rotating;
  const rotatingRate = rotating?.rates[lookup];
  if (rotating && rotatingRate !== undefined && ctx.today >= rotating.startDate && ctx.today <= rotating.endDate) {
    const covers = [...(Object.keys(rotating.rates) as CategoryId[]), ...(rotating.cap.sharedWith ?? [])];
    tiers.push({ rate: rotatingRate, source: "rotating", pool: poolFor(card, covers, rotating.cap) });
  }

  let best: EffectiveRate | null = null;
  for (const tier of tiers) {
    let rate = tier.rate;
    let pool = tier.pool;
    let capRemainingCents: Cents | null = null;
    if (pool) {
      capRemainingCents = ctx.ledger ? ctx.ledger.remaining(pool, ctx.today) : pool.cap.amountCents;
      if (capRemainingCents <= 0) {
        if (pool.cap.rateAfterCap === undefined) continue;
        rate = pool.cap.rateAfterCap;
        pool = null;
        capRemainingCents = null;
      }
    }
    const option: EffectiveRate = { cardId: card.id, rateBps: effectiveBps(rate, card), source: tier.source, capRemainingCents, pool };
    if (!best || isBetterTier(option, best)) best = option;
  }
  // The base tier is never capped, so there is always a result.
  return best!;
}

const CAPITAL_ONE_FAMILY: ReadonlySet<Issuer> = new Set(["Capital One", "Discover"]);

/**
 * Owned cards ranked for the next dollar in a category, best first. Tie-break, in order: no cap beats a
 * cap, lower annual fee, Capital One or Discover, lower popularityRank.
 */
export function rankCards(cards: readonly CreditCard[], category: CategoryId, ctx: RateContext): EffectiveRate[] {
  return cards
    .map(card => ({ card, option: getEffectiveRate(card, category, ctx) }))
    .sort((a, b) =>
      b.option.rateBps - a.option.rateBps
      || Number(a.option.pool !== null) - Number(b.option.pool !== null)
      || a.card.annualFeeCents - b.card.annualFeeCents
      || Number(CAPITAL_ONE_FAMILY.has(b.card.issuer)) - Number(CAPITAL_ONE_FAMILY.has(a.card.issuer))
      || a.card.popularityRank - b.card.popularityRank)
    .map(item => item.option);
}

// ---------- Month-by-month simulation ----------

type Earn = (cardId: string, category: CategoryId, spendCents: Cents, rateBps: Bps) => void;

export interface ProjectionOptions {
  selections?: Selections;
}

/** Each pass finishes the amount or uses up one cap, so this many passes means a bug, not a big wallet. */
const MAX_FILL_PASSES = 1_000;

/** Spends one category best-card-first. When the best card's cap runs out, the rest goes to the next-best card. */
function spendCategory(cards: readonly CreditCard[], category: CategoryId, amountCents: Cents, ctx: RateContext & { ledger: CapLedger }, earn?: Earn): void {
  let remaining = amountCents;
  for (let pass = 0; remaining > 0; pass++) {
    if (pass >= MAX_FILL_PASSES) throw new Error(`Spending ${category} did not settle.`);
    const best = rankCards(cards, category, ctx)[0];
    if (!best) return;
    const portion = best.capRemainingCents === null ? remaining : Math.min(remaining, best.capRemainingCents);
    earn?.(best.cardId, category, portion, best.rateBps);
    if (best.pool) ctx.ledger.add(best.pool, ctx.today, portion);
    remaining -= portion;
  }
}

/** Categories with spend, biggest first, so the biggest category uses a shared cap first. */
function spendOrder(profile: SpendProfile): { category: CategoryId; cents: Cents }[] {
  return CATEGORY_IDS
    .map((category, order) => ({ category, order, cents: profile[category] ?? 0 }))
    .filter(item => item.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.order - b.order);
}

/**
 * One month of spending, dated the first of the month. `rankingProfile` decides auto_top_spend
 * categories when `profile` is a prorated slice of the real monthly profile.
 */
function spendMonth(
  cards: readonly CreditCard[], profile: SpendProfile, monthStart: ISODate, ledger: CapLedger,
  options: ProjectionOptions, earn?: Earn, rankingProfile: SpendProfile = profile,
): void {
  const ctx = { today: monthStart, ledger, selections: options.selections, spendProfile: rankingProfile };
  for (const { category, cents } of spendOrder(profile)) spendCategory(cards, category, cents, ctx, earn);
}

function firstOfMonth(date: ISODate): ISODate {
  const { year, month } = dateParts(date);
  return clampedDate(year, month, 1);
}

export interface CardShare {
  cardId: string;
  spendCents: Cents;
  rewardCents: Cents;
}

export interface CategoryProjection {
  category: CategoryId;
  spendCents: Cents;
  rewardCents: Cents;
  /** Which cards earn on this category, most spend first. */
  byCard: CardShare[];
}

export interface WalletProjection {
  /** Yearly rewards before annual fees. */
  totalCents: Cents;
  /** Yearly rewards per card id; 0 for cards that earn nothing. */
  byCard: Record<string, Cents>;
  /** Categories with spend, most spend first. */
  categories: CategoryProjection[];
}

export const PROJECTION_MONTHS = 12;

/**
 * Yearly rewards for a set of cards: 12 calendar months starting with the current one, each filled
 * best-card-first from the monthly profile. Caps reset each calendar month, quarter, or year. Rotating
 * categories count only inside their date range; later months use the card's normal rates. Annual fees
 * are not subtracted here.
 */
export function projectWalletRewards(cards: readonly CreditCard[], spendProfile: SpendProfile, today: ISODate, options: ProjectionOptions = {}): WalletProjection {
  const ledger = new CapLedger();
  // Rewards accumulate as cents × bps, an exact integer, and are rounded once per card and category.
  const totals = new Map<CategoryId, Map<string, { spendCents: Cents; numerator: number }>>();
  const earn: Earn = (cardId, category, spendCents, rateBps) => {
    const byCard = totals.get(category) ?? new Map<string, { spendCents: Cents; numerator: number }>();
    const entry = byCard.get(cardId) ?? { spendCents: 0, numerator: 0 };
    entry.spendCents += spendCents;
    entry.numerator += spendCents * rateBps;
    byCard.set(cardId, entry);
    totals.set(category, byCard);
  };

  const start = firstOfMonth(today);
  for (let month = 0; month < PROJECTION_MONTHS; month++) spendMonth(cards, spendProfile, addMonths(start, month), ledger, options, earn);

  const byCard: Record<string, Cents> = Object.fromEntries(cards.map(card => [card.id, 0]));
  const categories: CategoryProjection[] = spendOrder(spendProfile).map(({ category }) => {
    const shares = [...(totals.get(category) ?? new Map()).entries()]
      .map(([cardId, entry]) => ({ cardId, spendCents: entry.spendCents, rewardCents: Math.round(entry.numerator / 10_000) }))
      .sort((a, b) => b.spendCents - a.spendCents);
    for (const share of shares) byCard[share.cardId] += share.rewardCents;
    return {
      category,
      spendCents: shares.reduce((sum, share) => sum + share.spendCents, 0),
      rewardCents: shares.reduce((sum, share) => sum + share.rewardCents, 0),
      byCard: shares,
    };
  });
  return { totalCents: categories.reduce((sum, item) => sum + item.rewardCents, 0), byCard, categories };
}

/** A profile scaled to part of a month, rounded to whole cents. */
function prorate(profile: SpendProfile, days: number, monthDays: number): SpendProfile {
  return Object.fromEntries(
    Object.entries(profile).map(([category, cents]) => [category, Math.round(((cents ?? 0) * days) / monthDays)]),
  ) as SpendProfile;
}

/**
 * Estimated cap use as of `today`, from the spend profile: January through last month in full, plus
 * this month prorated by the days before today. There is no per-card spending history, so this keeps
 * the "next dollar" rates and "bonus room left" figures consistent with the projection.
 */
export function estimateCapUsage(cards: readonly CreditCard[], spendProfile: SpendProfile, today: ISODate, options: ProjectionOptions = {}): CapLedger {
  const { year, month, day } = dateParts(today);
  const ledger = new CapLedger();
  for (let earlier = 1; earlier < month; earlier++) spendMonth(cards, spendProfile, clampedDate(year, earlier, 1), ledger, options);
  const elapsed = day - 1;
  if (elapsed > 0) {
    spendMonth(cards, prorate(spendProfile, elapsed, daysInMonth(year, month)), clampedDate(year, month, 1), ledger, options, undefined, spendProfile);
  }
  return ledger;
}

// ---------- Best owned card per category ----------

export interface CategoryWinner {
  category: CategoryId;
  monthlySpendCents: Cents;
  /** Best owned card for the next dollar today; null when no cards are owned. */
  winner: EffectiveRate | null;
  /** Second-best owned card, for "rewards vs. a suboptimal choice". */
  runnerUp: EffectiveRate | null;
}

/** For each of the 14 categories, the best owned card for the next dollar today, given cap use so far. */
export function bestCardsByCategory(ownedCards: readonly CreditCard[], spendProfile: SpendProfile, today: ISODate, options: ProjectionOptions = {}): CategoryWinner[] {
  const ledger = estimateCapUsage(ownedCards, spendProfile, today, options);
  const ctx: RateContext = { today, ledger, selections: options.selections, spendProfile };
  return CATEGORY_IDS.map(category => {
    const ranked = rankCards(ownedCards, category, ctx);
    return { category, monthlySpendCents: spendProfile[category] ?? 0, winner: ranked[0] ?? null, runnerUp: ranked[1] ?? null };
  });
}

export interface GoldCard {
  cardId: string;
  /** Categories this card wins, most spend first. */
  categories: CategoryId[];
  /** Total monthly spend in those categories. */
  monthlySpendCents: Cents;
}

/** "Gold" cards win at least one category with spend. Ordered by the monthly spend they win, largest first. */
export function goldCards(winners: readonly CategoryWinner[]): GoldCard[] {
  const byCard = new Map<string, GoldCard>();
  const withSpend = winners
    .filter(item => item.winner && item.monthlySpendCents > 0)
    .sort((a, b) => b.monthlySpendCents - a.monthlySpendCents);
  for (const item of withSpend) {
    const cardId = item.winner!.cardId;
    const gold = byCard.get(cardId) ?? { cardId, categories: [], monthlySpendCents: 0 };
    gold.categories.push(item.category);
    gold.monthlySpendCents += item.monthlySpendCents;
    byCard.set(cardId, gold);
  }
  // Stable sort keeps first-win order for equal totals.
  return [...byCard.values()].sort((a, b) => b.monthlySpendCents - a.monthlySpendCents);
}

// ---------- Cards worth adding ----------

export interface CardCandidate {
  cardId: string;
  /** Added yearly rewards before the annual fee. */
  gainCents: Cents;
  annualFeeCents: Cents;
  /** gainCents minus the annual fee. */
  netGainCents: Cents;
  /** Categories where the card would add rewards, biggest gain first. */
  takesOver: CategoryId[];
  requiresMembership?: string;
}

/** Suggestions must add at least this much a year after the annual fee. */
export const SUGGESTION_MIN_NET_CENTS = 2_500;

/** What one card would add to the wallet. Pass `baseline` to skip recomputing the wallet alone. */
export function evaluateCard(
  ownedCards: readonly CreditCard[], card: CreditCard, spendProfile: SpendProfile, today: ISODate,
  options: ProjectionOptions = {}, baseline: WalletProjection = projectWalletRewards(ownedCards, spendProfile, today, options),
): CardCandidate {
  const withCard = projectWalletRewards([...ownedCards, card], spendProfile, today, options);
  const gainCents = withCard.totalCents - baseline.totalCents;
  const before = new Map(baseline.categories.map(item => [item.category, item.rewardCents]));
  // A card can win a category on a tie-break without adding anything; those don't count as taking over.
  const takesOver = withCard.categories
    .filter(item => item.byCard.some(share => share.cardId === card.id && share.spendCents > 0))
    .map(item => ({ category: item.category, gainCents: item.rewardCents - (before.get(item.category) ?? 0) }))
    .filter(item => item.gainCents > 0)
    .sort((a, b) => b.gainCents - a.gainCents)
    .map(item => item.category);
  return {
    cardId: card.id,
    gainCents,
    annualFeeCents: card.annualFeeCents,
    netGainCents: gainCents - card.annualFeeCents,
    takesOver,
    ...(card.requiresMembership ? { requiresMembership: card.requiresMembership } : {}),
  };
}

/** Every catalog card the user doesn't own (business cards included), in catalog order. */
export function evaluateCandidates(ownedCards: readonly CreditCard[], catalog: readonly CreditCard[], spendProfile: SpendProfile, today: ISODate, options: ProjectionOptions = {}): CardCandidate[] {
  const owned = new Set(ownedCards.map(card => card.id));
  const baseline = projectWalletRewards(ownedCards, spendProfile, today, options);
  return catalog.filter(card => !owned.has(card.id)).map(card => evaluateCard(ownedCards, card, spendProfile, today, options, baseline));
}

/** Personal (non-business) candidates clearing the threshold, by net gain; ties go to the lower fee, then popularity. */
export function rankSuggestions(candidates: readonly CardCandidate[], catalog: readonly CreditCard[], limit: number, exclude: readonly string[] = []): CardCandidate[] {
  const cards = new Map(catalog.map(card => [card.id, card]));
  const skip = new Set(exclude);
  return candidates
    .filter(item => !skip.has(item.cardId) && cards.get(item.cardId)?.isBusiness === false && item.netGainCents >= SUGGESTION_MIN_NET_CENTS)
    .sort((a, b) => b.netGainCents - a.netGainCents || a.annualFeeCents - b.annualFeeCents || cards.get(a.cardId)!.popularityRank - cards.get(b.cardId)!.popularityRank)
    .slice(0, limit);
}

export interface SuggestOptions extends ProjectionOptions {
  /** Card ids to leave out, such as dismissed suggestions. */
  exclude?: readonly string[];
}

/** Cards the user doesn't own, ranked by net yearly gain after the annual fee. */
export function suggestCards(
  ownedCards: readonly CreditCard[], catalog: readonly CreditCard[], spendProfile: SpendProfile, today: ISODate,
  limit = 3, options: SuggestOptions = {},
): CardCandidate[] {
  return rankSuggestions(evaluateCandidates(ownedCards, catalog, spendProfile, today, options), catalog, limit, options.exclude);
}

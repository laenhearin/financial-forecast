export type ISODate = string;   // "YYYY-MM-DD", always treated as UTC
export type Cents = number;     // integer cents
/** Basis points: 100 = 1%. Points cards use the same scale because 1 point = 1 cent. */
export type Bps = number;

export const CATEGORIES = [
  "gas", "groceries", "dining", "streaming", "travel", "drugstores", "online", "entertainment", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export type CapPeriod = "monthly" | "quarterly";

/** A bonus rate on one or more categories, optionally with a spending cap shared by those categories. */
export interface BonusTier {
  categories: Category[];
  rateBps: Bps;
  /** Above the cap the card earns its base rate until the period resets. */
  cap?: { amountCents: Cents; period: CapPeriod };
}

export interface CardDefinition {
  id: string;
  name: string;
  /** Points are treated as cash back: 1 point = 1 cent. */
  rewardType: "cashback" | "points";
  baseRateBps: Bps;
  tiers: BonusTier[];
  annualFeeCents: Cents;
  blurb: string;
}

export interface Purchase {
  id: string;
  date: ISODate;
  merchant: string;
  amountCents: Cents;
  /** The card that was actually used. */
  cardId: string;
}

/** keyword: matched the keyword list. ai: classified by the model. fallback: unmatched and counted as "other". */
export type CategorySource = "keyword" | "ai" | "fallback";

export interface CategorizedPurchase extends Purchase {
  category: Category;
  categorySource: CategorySource;
}

export type WindowDays = 30 | 90;

// ---------- Engine outputs ----------

export interface CardOption {
  cardId: string;
  cardName: string;
  rewardCents: Cents;
  /** The card's advertised rate for this category, before any cap. */
  rateBps: Bps;
  /** True when some or all of this purchase falls above the cap and earns the base rate. */
  capped: boolean;
  /** Cap room left before this purchase; null when the category has no cap on this card. */
  capRemainingCents: Cents | null;
  capPeriod: CapPeriod | null;
}

export interface ScoredPurchase {
  purchase: CategorizedPurchase;
  actual: CardOption;
  best: CardOption;
  /** best minus actual. Can be negative only in rare cap interactions; flags ignore those. */
  missedCents: Cents;
}

export interface RewardsResult {
  scored: ScoredPurchase[];
  actualCents: Cents;
  bestCents: Cents;
  /** bestCents minus actualCents. Equals the sum of positive misses plus capAdjustmentCents. */
  missedCents: Cents;
  /**
   * Zero or negative. Following the playbook earlier can use up a card's cap, so a later purchase that
   * really did get the bonus would have earned less. This is the sum of those differences.
   */
  capAdjustmentCents: Cents;
}

export interface WrongCardFlag {
  purchaseId: string;
  date: ISODate;
  merchant: string;
  category: Category;
  amountCents: Cents;
  usedCardId: string;
  usedCardName: string;
  usedRateBps: Bps;
  betterCardId: string;
  betterCardName: string;
  betterRateBps: Bps;
  missedCents: Cents;
}

export interface PlaybookEntry {
  category: Category;
  spendCents: Cents;
  primary: { cardId: string; cardName: string; rateBps: Bps };
  /** Present when the primary card's rate for this category is capped. */
  cap: { amountCents: Cents; period: CapPeriod; remainingCents: Cents; afterCapRateBps: Bps } | null;
  /** The card that takes over once the cap is reached; null when no cap or the same card stays best. */
  fallback: { cardId: string; cardName: string; rateBps: Bps } | null;
}

export interface NewCardSuggestion {
  cardId: string;
  cardName: string;
  annualFeeCents: Cents;
  isHighFee: boolean;
  gainWindowCents: Cents;
  gainAnnualCents: Cents;
  /** gainAnnualCents minus the annual fee. */
  netAnnualCents: Cents;
  /** Categories where the new card adds the most, largest first. */
  topCategories: { category: Category; gainWindowCents: Cents }[];
}

export interface SuggestionResult {
  suggestion: NewCardSuggestion | null;
  /** High-fee cards that would add rewards but were not suggested (fee too high or not a clear win). */
  skippedHighFee: { cardId: string; cardName: string; annualFeeCents: Cents; gainAnnualCents: Cents; netAnnualCents: Cents }[];
}

export interface CashBackAnalysis {
  asOfDate: ISODate;
  windowDays: WindowDays;
  windowStart: ISODate;
  purchaseCount: number;
  spendCents: Cents;
  rewards: RewardsResult;
  missedAnnualCents: Cents;
  flags: WrongCardFlag[];
  playbook: PlaybookEntry[];
  suggestion: SuggestionResult;
}

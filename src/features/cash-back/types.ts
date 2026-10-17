// Types for the Cash Back feature: spending categories, the real-card catalog, and purchases.
// No UI imports here, so the engine and its tests can use these directly.

export type ISODate = string;   // "YYYY-MM-DD", always treated as UTC
export type Cents = number;     // integer cents
/** Basis points: 100 = 1%. Effective (cash-equivalent) rates use this scale. */
export type Bps = number;

// ---------- Spending categories ----------

/** The 14 standardized categories, used everywhere. Anything unmapped is "other". */
export const CATEGORY_IDS = [
  "dining", "groceries", "gas", "travel", "travel_portal", "transit",
  "streaming", "entertainment", "online_shopping", "amazon",
  "drugstores", "wholesale", "utilities", "other",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

// ---------- Card catalog ----------

/** Issuer display and sort order: Capital One first, then Discover (a Capital One company). */
export const ISSUERS = [
  "Capital One", "Discover", "Chase", "American Express", "Citi", "Wells Fargo", "Bank of America", "U.S. Bank", "Apple",
] as const;
export type Issuer = (typeof ISSUERS)[number];

/** Display only; never used in calculations. */
export type Network = "Visa" | "Mastercard" | "Amex" | "Discover";

export type RewardCurrency = "cash" | "points" | "miles";

export type CapPeriod = "month" | "quarter" | "year";

/**
 * A spending limit on a bonus rate. Calendar periods: quarters start in Jan, Apr, Jul, and Oct.
 * Caps on one card share one limit when they cover the same set of categories (the rule's own
 * categories plus sharedWith); the catalog test checks that shared caps match.
 */
export interface SpendCap {
  /** Spend at the bonus rate per period. */
  amountCents: Cents;
  period: CapPeriod;
  /** Other categories that share this same cap. */
  sharedWith?: CategoryId[];
  /** Rate once the cap is used up. Omitted: the card's next-best rate for that category. */
  rateAfterCap?: number;
}

export interface CategoryRule {
  category: CategoryId;
  /** Earn rate in the card's own currency: 3 means 3x points or 3% cash. */
  rate: number;
  cap?: SpendCap;
  /** Short human note, e.g. "U.S. supermarkets". */
  note?: string;
}

export interface RotatingCategories {
  quarter: string;                              // "Q4 2026"
  startDate: ISODate;
  endDate: ISODate;
  /** Total rate per category while active. */
  rates: Partial<Record<CategoryId, number>>;
  /** What the issuer calls them. */
  label: string;
  /** One cap shared across all rotating categories. */
  cap: SpendCap;
  requiresActivation: boolean;
}

/** User-chosen (BofA, U.S. Bank) or automatic top-spend (Citi Custom Cash) bonus categories. */
export interface SelectableCategory {
  mode: "user_choice" | "auto_top_spend";
  /** How many categories get the bonus. */
  picks: number;
  options: CategoryId[];
  rate: number;
  /** Used until the user picks; length === picks. */
  defaultChoices: CategoryId[];
  /** Shared across every option (and sharedWith). */
  cap?: SpendCap;
}

/** Merchant-specific earning that doesn't fit a category. Display only, never used in category math. */
export interface MerchantRule {
  merchant: string;
  rate: number;
}

/** Original gradients loosely evoking each card. No real card art or logos. */
export interface CardVisual {
  gradientFrom: string;  // #rrggbb
  gradientTo: string;    // #rrggbb
  textColor: string;     // #rrggbb, readable on the gradient
}

export interface CreditCard {
  /** kebab-case, e.g. "capital-one-savor" */
  id: string;
  /** Short name shown in the table, e.g. "Savor". */
  name: string;
  /** "Capital One Savor Cash Rewards" */
  fullName: string;
  issuer: Issuer;
  network: Network;
  isBusiness: boolean;
  isStudent: boolean;
  annualFeeCents: Cents;
  currency: RewardCurrency;
  /** Cents per point or mile, for comparison (cash = 1). A fixed, conservative config value. */
  pointValueCents: number;
  /** Earn rate on "other" and any category without a rule. */
  baseRate: number;
  categoryRules: CategoryRule[];
  rotating?: RotatingCategories;
  selectable?: SelectableCategory;
  merchantRules?: MerchantRule[];
  /** e.g. "Amazon Prime", "Costco membership" */
  requiresMembership?: string;
  /** 1 to 3 short, neutral perks for the detail drawer. No sign-up bonus amounts. */
  highlights: string[];
  /** 1 = most popular; unique across the catalog. */
  popularityRank: number;
  visual: CardVisual;
  /** ISO date the reward data was checked. */
  lastVerified: ISODate;
}

// ---------- Spending ----------

/** Monthly spend per category. Missing categories count as zero. */
export type SpendProfile = Partial<Record<CategoryId, Cents>>;

/** Chosen bonus categories for user_choice cards, keyed by card id. */
export type Selections = Readonly<Record<string, readonly CategoryId[]>>;

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
  category: CategoryId;
  categorySource: CategorySource;
}

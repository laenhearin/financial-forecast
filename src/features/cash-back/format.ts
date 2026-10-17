import { formatUSD } from "../../lib/money";
import type { Bps, CapPeriod, CategoryId, Cents, CreditCard, Issuer, SpendCap } from "./types";

/** Full labels, as in the drawer and search. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  dining: "Dining",
  groceries: "Groceries",
  gas: "Gas & EV charging",
  travel: "Travel (general)",
  travel_portal: "Travel via issuer portal",
  transit: "Transit & rideshare",
  streaming: "Streaming",
  entertainment: "Entertainment",
  online_shopping: "Online shopping",
  amazon: "Amazon & Whole Foods",
  drugstores: "Drugstores",
  wholesale: "Wholesale clubs",
  utilities: "Utilities & phone",
  other: "Everything else",
};

/** Short labels for chips and badges: "5% Utilities". */
export const CATEGORY_SHORT_LABELS: Record<CategoryId, string> = {
  dining: "Dining",
  groceries: "Groceries",
  gas: "Gas",
  travel: "Travel",
  travel_portal: "Travel portal",
  transit: "Transit",
  streaming: "Streaming",
  entertainment: "Entertainment",
  online_shopping: "Online",
  amazon: "Amazon",
  drugstores: "Drugstores",
  wholesale: "Wholesale",
  utilities: "Utilities",
  other: "Other",
};

/** Lowercase for mid-sentence use: "use it for dining". */
export function categoryNoun(category: CategoryId): string {
  return CATEGORY_SHORT_LABELS[category].toLowerCase();
}

/** Group label rows in the card table. */
export const ISSUER_LABELS: Record<Issuer, string> = {
  "Capital One": "Capital One",
  Discover: "Discover · a Capital One company",
  Chase: "Chase",
  "American Express": "American Express",
  Citi: "Citi",
  "Wells Fargo": "Wells Fargo",
  "Bank of America": "Bank of America",
  "U.S. Bank": "U.S. Bank",
  Apple: "Apple",
};

const ISSUER_SHORT: Record<Issuer, string> = {
  "Capital One": "Capital One",
  Discover: "Discover",
  Chase: "Chase",
  "American Express": "Amex",
  Citi: "Citi",
  "Wells Fargo": "Wells Fargo",
  "Bank of America": "BofA",
  "U.S. Bank": "U.S. Bank",
  Apple: "Apple",
};

/** Name with the issuer in front, for sentences and button labels: "Capital One Savor", "Citi Custom Cash". */
export function brandedName(card: Pick<CreditCard, "name" | "issuer">): string {
  const issuer = ISSUER_SHORT[card.issuer];
  return card.name.startsWith(issuer) ? card.name : `${issuer} ${card.name}`;
}

/** 400 -> "4", 150 -> "1.5", 125 -> "1.25". */
function bpsNumber(bps: Bps): string {
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

/** Effective (cash-equivalent) rate: "4%". */
export function formatRate(bps: Bps): string {
  return `${bpsNumber(bps)}%`;
}

/** How the card advertises a rate in its own currency: "3%" for cash, "3x" for points and miles. */
export function formatEarnRate(rate: number, card: Pick<CreditCard, "currency">): string {
  const text = bpsNumber(Math.round(rate * 100));
  return card.currency === "cash" ? `${text}%` : `${text}x`;
}

/** A card-currency rate as basis points of cash value: 3x at 1 cent = 300. */
export function effectiveBps(rate: number, card: Pick<CreditCard, "pointValueCents">): Bps {
  return Math.round(rate * 100 * card.pointValueCents);
}

/** Rounds to whole dollars for display: "$412". */
export function formatWholeDollars(cents: Cents): string {
  return formatUSD(Math.round(cents / 100) * 100);
}

/** "+$108/yr" */
export function formatYearlyGain(cents: Cents): string {
  return `+${formatWholeDollars(cents)}/yr`;
}

export function periodNoun(period: CapPeriod): string {
  return period === "month" ? "month" : period === "quarter" ? "quarter" : "year";
}

const PERIOD_ABBREVIATIONS: Record<CapPeriod, string> = { month: "mo", quarter: "qtr", year: "yr" };

/** "up to $6,000/yr" */
export function formatCap(cap: SpendCap): string {
  return `up to ${formatWholeDollars(cap.amountCents)}/${PERIOD_ABBREVIATIONS[cap.period]}`;
}

/** "Groceries and Streaming", "Dining, Gas, and Transit" */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 2) return words.join(" and ");
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

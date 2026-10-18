import { categorizeByKeyword } from "../features/cash-back/engine/categorize";
import type { CategoryId } from "../features/cash-back/types";

/**
 * Transaction categories shared by the Nessie demo-history generator and the profile normalizer.
 * Seed v2 records carry their category in the description marker
 * ("ff-demo-v2/college/0042/spend:groceries | SYNTHETIC | Publix"); any other record is classified
 * from its label. Pure and client-safe.
 */

export const SPENDING_CATEGORIES = {
  groceries: { label: "Groceries", cashBack: "groceries", maxCutPercent: 10 },
  dining: { label: "Dining out", cashBack: "dining", maxCutPercent: 40 },
  coffee: { label: "Coffee shops", cashBack: "dining", maxCutPercent: 50 },
  gas: { label: "Gas", cashBack: "gas", maxCutPercent: 10 },
  transit: { label: "Transit and rideshare", cashBack: "transit", maxCutPercent: 25 },
  streaming: { label: "Streaming", cashBack: "streaming", maxCutPercent: 50 },
  entertainment: { label: "Entertainment", cashBack: "entertainment", maxCutPercent: 50 },
  amazon: { label: "Amazon", cashBack: "amazon", maxCutPercent: 30 },
  online_shopping: { label: "Online shopping", cashBack: "online_shopping", maxCutPercent: 40 },
  wholesale: { label: "Warehouse club", cashBack: "wholesale", maxCutPercent: 10 },
  clothing: { label: "Clothing", cashBack: "other", maxCutPercent: 40 },
  household: { label: "Home and household", cashBack: "other", maxCutPercent: 25 },
  drugstores: { label: "Pharmacy", cashBack: "drugstores", maxCutPercent: 10 },
  personal_care: { label: "Personal care", cashBack: "other", maxCutPercent: 30 },
  school: { label: "School and books", cashBack: "other", maxCutPercent: 0 },
  auto: { label: "Car care", cashBack: "other", maxCutPercent: 0 },
  gifts: { label: "Gifts", cashBack: "other", maxCutPercent: 50 },
  travel: { label: "Travel", cashBack: "travel", maxCutPercent: 50 },
  education: { label: "Tuition and fees", cashBack: "other", maxCutPercent: 0 },
  insurance: { label: "Insurance", cashBack: "other", maxCutPercent: 0 },
  health: { label: "Health and dental", cashBack: "other", maxCutPercent: 0 },
  family: { label: "Family support", cashBack: "other", maxCutPercent: 0 },
  other: { label: "Other spending", cashBack: "other", maxCutPercent: 20 },
} as const satisfies Record<string, { label: string; cashBack: CategoryId; maxCutPercent: number }>;

export type SpendingCategoryId = keyof typeof SPENDING_CATEGORIES;

export function isSpendingCategoryId(value: unknown): value is SpendingCategoryId {
  return typeof value === "string" && Object.hasOwn(SPENDING_CATEGORIES, value);
}

/**
 * What a recorded transaction was, for averaging and totals:
 * - spend: everyday spending, averaged into the forecast's monthly categories.
 * - one-off: an irregular expense (tuition, a trip); real spending, but not projected forward.
 * - bill: a payment of a scheduled Nessie bill; the forecast already schedules future ones.
 * - saving: money moved to an account outside this app (retirement, brokerage); not spending.
 * - transfer: between the customer's own accounts; neither income nor spending.
 * - income and interest: money in.
 */
export type TransactionFlow = "income" | "interest" | "spend" | "one-off" | "bill" | "saving" | "transfer";

export interface TransactionClass {
  flow: TransactionFlow;
  /** Spending category for spend and one-off; null otherwise. */
  category: SpendingCategoryId | null;
}

const TAG_FLOWS: Record<string, TransactionFlow> = {
  income: "income", interest: "interest", spend: "spend", oneoff: "one-off", bill: "bill", saving: "saving", transfer: "transfer",
};

/** The tag part of a seed marker: "spend:groceries", "bill:housing", "income". */
export type TransactionTag = `${"spend" | "oneoff"}:${SpendingCategoryId}` | `bill:${string}` | "income" | "interest" | "saving" | "transfer";

/** "ff-demo-v2/college/0042/spend:groceries | SYNTHETIC | Publix". */
export function seedDescription(seedId: string, slug: string, sequence: number, tag: TransactionTag, label: string): string {
  return `${seedId}/${slug}/${String(sequence).padStart(4, "0")}/${tag} | SYNTHETIC | ${label}`;
}

const MARKER = /^ff-demo-v\d+\/[a-z0-9-]+\/\d+\/([a-z]+)(?::([a-z_]+))? \|/;

/** The class stored in a seed marker, or null for any other description. */
export function parseSeedTag(description: string): TransactionClass | null {
  const match = MARKER.exec(description.trim());
  const flow = match ? TAG_FLOWS[match[1]] : undefined;
  if (!match || !flow) return null;
  const category = flow === "spend" || flow === "one-off" ? match[2] : undefined;
  if (category !== undefined && !isSpendingCategoryId(category)) return null;
  return { flow, category: category ?? null };
}

/** Labels the cash-back keyword list doesn't place, checked first. */
const LABEL_RULES: [RegExp, SpendingCategoryId][] = [
  [/textbook|school suppl|bookstore/i, "school"],
  [/tires|auto service|oil change|car wash/i, "auto"],
  [/home depot|lowe'?s|repair suppl/i, "household"],
  [/cvs|walgreens|pharmacy/i, "drugstores"],
  [/cinema|movie|concert|tickets/i, "entertainment"],
  [/haircut|salon|barber/i, "personal_care"],
  [/coffee|starbucks|dunkin/i, "coffee"],
];

const FROM_CASH_BACK: Partial<Record<CategoryId, SpendingCategoryId>> = {
  dining: "dining", groceries: "groceries", gas: "gas", travel: "travel", travel_portal: "travel", transit: "transit",
  streaming: "streaming", entertainment: "entertainment", online_shopping: "online_shopping", amazon: "amazon",
  drugstores: "drugstores", wholesale: "wholesale",
};

/** Seed marker first; otherwise deposits are income and withdrawals are spending, categorized by their label. */
export function classifyTransaction(kind: "deposit" | "withdrawal", description: string, label: string): TransactionClass {
  const tagged = parseSeedTag(description);
  if (tagged) return tagged;
  if (kind === "deposit") return { flow: "income", category: null };
  const rule = LABEL_RULES.find(([pattern]) => pattern.test(label));
  if (rule) return { flow: "spend", category: rule[1] };
  const cashBack = categorizeByKeyword(label);
  return { flow: "spend", category: (cashBack && FROM_CASH_BACK[cashBack]) ?? "other" };
}

/** Groups bills for the critical-balance default (housing) and advice; Nessie bills have no category field. */
export function billCategory(label: string): string {
  if (/rent|housing|mortgage/i.test(label)) return "housing";
  if (/util|internet|electric|water|phone|mobile/i.test(label)) return "utilities";
  if (/loan|debt|credit/i.test(label)) return "debt";
  if (/transit|car|auto|insurance/i.test(label)) return "transport";
  return "other";
}

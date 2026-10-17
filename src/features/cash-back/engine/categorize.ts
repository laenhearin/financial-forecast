import { isCategoryId, type CategorizedPurchase, type CategoryId, type Purchase } from "../types";

/**
 * Maps merchant names onto the 14 standard categories. Keyword list, checked in order: more specific
 * phrases come first ("uber eats" before "uber", "whole foods" before "foods"). Keywords match whole
 * words in the normalized merchant name, so "bp" matches "BP #4411" but not "BPX Outfitters".
 * Superstores (Walmart, Target) stay "other": most cards don't count them as groceries.
 */
const KEYWORDS: [keyword: string, category: CategoryId][] = [
  // Phrases that would otherwise hit another category
  ["uber eats", "dining"], ["doordash", "dining"], ["grubhub", "dining"],
  ["whole foods", "amazon"], ["amazon", "amazon"], ["amzn", "amazon"],
  ["costco gas", "gas"], ["costco", "wholesale"], ["sams club", "wholesale"], ["bjs wholesale", "wholesale"],
  ["capital one travel", "travel_portal"], ["chase travel", "travel_portal"], ["amex travel", "travel_portal"], ["citi travel", "travel_portal"],
  // Gas & EV charging
  ["shell", "gas"], ["exxon", "gas"], ["exxonmobil", "gas"], ["mobil", "gas"], ["chevron", "gas"], ["bp", "gas"],
  ["texaco", "gas"], ["sunoco", "gas"], ["citgo", "gas"], ["marathon", "gas"], ["speedway", "gas"],
  ["wawa", "gas"], ["racetrac", "gas"], ["circle k", "gas"], ["valero", "gas"], ["quiktrip", "gas"],
  ["chargepoint", "gas"], ["supercharger", "gas"], ["electrify america", "gas"], ["fuel", "gas"], ["gas station", "gas"],
  // Groceries
  ["publix", "groceries"], ["kroger", "groceries"], ["aldi", "groceries"], ["trader joe", "groceries"], ["trader joes", "groceries"],
  ["safeway", "groceries"], ["winn dixie", "groceries"], ["food lion", "groceries"],
  ["heb", "groceries"], ["sprouts", "groceries"], ["wegmans", "groceries"], ["instacart", "groceries"],
  ["grocery", "groceries"], ["groceries", "groceries"], ["supermarket", "groceries"],
  // Dining
  ["starbucks", "dining"], ["chipotle", "dining"], ["mcdonald", "dining"], ["mcdonalds", "dining"],
  ["chick fil a", "dining"], ["panera", "dining"], ["domino", "dining"], ["dominos", "dining"],
  ["taco bell", "dining"], ["wendy", "dining"], ["wendys", "dining"], ["burger king", "dining"],
  ["dunkin", "dining"], ["pizza", "dining"], ["cafe", "dining"], ["restaurant", "dining"],
  ["grill", "dining"], ["diner", "dining"], ["sushi", "dining"], ["bbq", "dining"], ["bistro", "dining"],
  // Streaming
  ["netflix", "streaming"], ["spotify", "streaming"], ["hulu", "streaming"], ["disney plus", "streaming"],
  ["youtube premium", "streaming"], ["apple music", "streaming"], ["peacock", "streaming"], ["paramount plus", "streaming"],
  // Transit & rideshare
  ["uber", "transit"], ["lyft", "transit"], ["amtrak", "transit"], ["parking", "transit"], ["toll", "transit"], ["sunpass", "transit"],
  ["transit", "transit"],
  // Travel (general)
  ["delta", "travel"], ["american airlines", "travel"], ["united airlines", "travel"], ["southwest", "travel"],
  ["jetblue", "travel"], ["marriott", "travel"], ["hilton", "travel"], ["hyatt", "travel"], ["airbnb", "travel"],
  ["expedia", "travel"], ["hertz", "travel"], ["enterprise rent", "travel"], ["hotel", "travel"], ["airlines", "travel"],
  // Drugstores
  ["cvs", "drugstores"], ["walgreens", "drugstores"], ["rite aid", "drugstores"], ["pharmacy", "drugstores"],
  // Online shopping
  ["etsy", "online_shopping"], ["ebay", "online_shopping"], ["wayfair", "online_shopping"], ["chewy", "online_shopping"],
  // Entertainment
  ["amc", "entertainment"], ["regal", "entertainment"], ["cinemark", "entertainment"], ["ticketmaster", "entertainment"],
  ["stubhub", "entertainment"], ["cinema", "entertainment"], ["theatre", "entertainment"], ["theater", "entertainment"],
  ["bowling", "entertainment"], ["topgolf", "entertainment"], ["museum", "entertainment"],
  // Utilities & phone
  ["duke energy", "utilities"], ["fpl", "utilities"], ["electric", "utilities"], ["utilities", "utilities"],
  ["comcast", "utilities"], ["xfinity", "utilities"], ["spectrum", "utilities"], ["verizon", "utilities"],
  ["att", "utilities"], ["t mobile", "utilities"], ["internet", "utilities"],
];

/** Lowercase, apostrophes and ampersands dropped, other punctuation to spaces: "Trader Joe's #12" -> "trader joes 12". */
export function normalizeMerchant(name: string): string {
  return name.toLowerCase().replace(/['’&]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const PREPARED = KEYWORDS.map(([keyword, category]) => ({ needle: ` ${normalizeMerchant(keyword)} `, category }));

/** Keyword match only. Returns null when nothing matches; those merchants can go to the AI classifier. */
export function categorizeByKeyword(merchant: string): CategoryId | null {
  const haystack = ` ${normalizeMerchant(merchant)} `;
  for (const { needle, category } of PREPARED) {
    if (haystack.includes(needle)) return category;
  }
  return null;
}

/**
 * Applies keyword matches first, then any AI-provided categories (keyed by the exact merchant name).
 * Anything still unmatched counts as "other" with source "fallback".
 */
export function categorize(purchases: readonly Purchase[], aiCategories: Readonly<Record<string, CategoryId>> = {}): CategorizedPurchase[] {
  return purchases.map(purchase => {
    const keyword = categorizeByKeyword(purchase.merchant);
    if (keyword) return { ...purchase, category: keyword, categorySource: "keyword" };
    const ai = Object.hasOwn(aiCategories, purchase.merchant) ? aiCategories[purchase.merchant] : undefined;
    if (isCategoryId(ai)) return { ...purchase, category: ai, categorySource: "ai" };
    return { ...purchase, category: "other", categorySource: "fallback" };
  });
}

/** Unique merchant names the keyword list could not place, in first-seen order. */
export function unmatchedMerchants(purchases: readonly Purchase[]): string[] {
  const seen = new Set<string>();
  for (const purchase of purchases) {
    if (!seen.has(purchase.merchant) && categorizeByKeyword(purchase.merchant) === null) seen.add(purchase.merchant);
  }
  return [...seen];
}

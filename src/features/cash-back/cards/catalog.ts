// EDIT HERE. The real-card catalog for Cash Back: 30 cards, Capital One first.
// Nessie has no rewards data, so every card's rules live in this file. Rates were checked against
// October 2026 issuer coverage (lastVerified); re-check the top cards on issuer sites before a demo.
// Rates are in the card's own currency (3 = 3x points or 3% cash); every card values points at
// 1 cent, so 3x = 3% effective. Caps and fees are authored in dollars and stored as cents.
// Portal-only rates go in travel_portal. Merchant-only rates go in merchantRules (display only).
// Visual colors are original gradients, not real card art. Run npm test after editing.
import { dollarsToCents } from "../../../lib/money";
import type { CapPeriod, CategoryId, CategoryRule, CreditCard, SpendCap } from "../types";

const VERIFIED = "2026-10-17";

function cap(dollars: number, period: CapPeriod, sharedWith?: CategoryId[]): SpendCap {
  return { amountCents: dollarsToCents(dollars), period, ...(sharedWith ? { sharedWith } : {}) };
}

function rule(category: CategoryId, rate: number, extra: Omit<CategoryRule, "category" | "rate"> = {}): CategoryRule {
  return { category, rate, ...extra };
}

function visual(gradientFrom: string, gradientTo: string, textColor: string) {
  return { gradientFrom, gradientTo, textColor };
}

/** Shared by every card; fields can be overridden per card. */
const DEFAULTS = {
  isBusiness: false,
  isStudent: false,
  pointValueCents: 1,
  lastVerified: VERIFIED,
} as const;

const CAPITAL_ONE_TRAVEL = "Hotels and rental cars booked through Capital One Travel";
const SAVOR_RULES: CategoryRule[] = [
  rule("dining", 3),
  rule("entertainment", 3),
  rule("streaming", 3),
  rule("groceries", 3, { note: "Grocery stores, excluding superstores like Walmart and Target" }),
  rule("travel_portal", 5, { note: CAPITAL_ONE_TRAVEL }),
];

/** BofA Customized Cash: the 3% choice and the 2% grocery and wholesale categories share one quarterly cap. */
const BOFA_SHARED_CAP: CategoryId[] = ["groceries", "wholesale", "gas", "online_shopping", "dining", "travel", "drugstores"];
const bofaCap = (own: CategoryId[]) => cap(2_500, "quarter", BOFA_SHARED_CAP.filter(category => !own.includes(category)));

export const CARD_CATALOG: readonly CreditCard[] = [
  // ---------- Capital One ----------
  {
    ...DEFAULTS,
    id: "capital-one-venture-x", name: "Venture X", fullName: "Capital One Venture X Rewards",
    issuer: "Capital One", network: "Visa", annualFeeCents: dollarsToCents(395), currency: "miles", baseRate: 2,
    categoryRules: [rule("travel_portal", 5, { note: "Flights and vacation rentals through Capital One Travel" })],
    merchantRules: [{ merchant: "Capital One Travel hotels and rental cars", rate: 10 }],
    highlights: ["Annual travel credit via Capital One Travel", "Airport lounge access", "Anniversary bonus miles each year"],
    popularityRank: 2, visual: visual("#1f2a37", "#4b5563", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-quicksilver", name: "Quicksilver", fullName: "Capital One Quicksilver Cash Rewards",
    issuer: "Capital One", network: "Mastercard", annualFeeCents: 0, currency: "cash", baseRate: 1.5,
    categoryRules: [rule("travel_portal", 5, { note: CAPITAL_ONE_TRAVEL })],
    highlights: ["Flat 1.5% on every purchase", "No foreign transaction fees"],
    popularityRank: 4, visual: visual("#9ca3af", "#e5e7eb", "#111827"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-savor", name: "Savor", fullName: "Capital One Savor Cash Rewards",
    issuer: "Capital One", network: "Mastercard", annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: SAVOR_RULES,
    merchantRules: [{ merchant: "Capital One Entertainment purchases", rate: 8 }],
    highlights: ["3% on dining, entertainment, streaming, and groceries", "No foreign transaction fees"],
    popularityRank: 7, visual: visual("#7a3b1d", "#c2703d", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-venture", name: "Venture", fullName: "Capital One Venture Rewards",
    issuer: "Capital One", network: "Visa", annualFeeCents: dollarsToCents(95), currency: "miles", baseRate: 2,
    categoryRules: [rule("travel_portal", 5, { note: CAPITAL_ONE_TRAVEL })],
    highlights: ["Credit for Global Entry or TSA PreCheck", "Transfer miles to airline and hotel partners"],
    popularityRank: 11, visual: visual("#0b3a5b", "#1d6fa5", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-savor-student", name: "Savor Student", fullName: "Capital One Savor Student Cash Rewards",
    issuer: "Capital One", network: "Mastercard", isStudent: true, annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: SAVOR_RULES,
    merchantRules: [{ merchant: "Capital One Entertainment purchases", rate: 8 }],
    highlights: ["Made for students building credit", "3% on dining, entertainment, streaming, and groceries"],
    popularityRank: 19, visual: visual("#8a4a2a", "#d98b57", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-quicksilver-student", name: "Quicksilver Student", fullName: "Capital One Quicksilver Student Cash Rewards",
    issuer: "Capital One", network: "Mastercard", isStudent: true, annualFeeCents: 0, currency: "cash", baseRate: 1.5,
    categoryRules: [rule("travel_portal", 5, { note: CAPITAL_ONE_TRAVEL })],
    highlights: ["Made for students building credit", "Flat 1.5% on every purchase"],
    popularityRank: 20, visual: visual("#6b7280", "#d1d5db", "#111827"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-ventureone", name: "VentureOne", fullName: "Capital One VentureOne Rewards",
    issuer: "Capital One", network: "Visa", annualFeeCents: 0, currency: "miles", baseRate: 1.25,
    categoryRules: [rule("travel_portal", 5, { note: CAPITAL_ONE_TRAVEL })],
    highlights: ["No annual fee", "Transfer miles to airline and hotel partners"],
    popularityRank: 25, visual: visual("#3a5f7d", "#7ea6c4", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-quicksilverone", name: "QuicksilverOne", fullName: "Capital One QuicksilverOne Cash Rewards",
    issuer: "Capital One", network: "Discover", annualFeeCents: dollarsToCents(39), currency: "cash", baseRate: 1.5,
    categoryRules: [rule("travel_portal", 5, { note: CAPITAL_ONE_TRAVEL })],
    highlights: ["For people with fair credit", "Automatic reviews for a higher credit line"],
    popularityRank: 27, visual: visual("#4b5563", "#9ca3af", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-spark-cash-plus", name: "Spark Cash Plus", fullName: "Capital One Spark Cash Plus",
    issuer: "Capital One", network: "Mastercard", isBusiness: true, annualFeeCents: dollarsToCents(150), currency: "cash", baseRate: 2,
    categoryRules: [rule("travel_portal", 5, { note: "Hotels and rental cars booked through Capital One Business Travel" })],
    highlights: ["Business card", "Unlimited 2% cash back", "No preset spending limit"],
    popularityRank: 29, visual: visual("#0f172a", "#334155", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "capital-one-quicksilver-secured", name: "Quicksilver Secured", fullName: "Capital One Quicksilver Secured Cash Rewards",
    issuer: "Capital One", network: "Mastercard", annualFeeCents: 0, currency: "cash", baseRate: 1.5,
    categoryRules: [rule("travel_portal", 5, { note: CAPITAL_ONE_TRAVEL })],
    highlights: ["Secured card for building credit", "Refundable security deposit"],
    popularityRank: 30, visual: visual("#374151", "#6b7280", "#ffffff"),
  },

  // ---------- Discover (a Capital One company) ----------
  {
    ...DEFAULTS,
    id: "discover-it-cash-back", name: "Discover it", fullName: "Discover it Cash Back",
    issuer: "Discover", network: "Discover", annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: [],
    rotating: {
      quarter: "Q4 2026", startDate: "2026-10-01", endDate: "2026-12-31",
      rates: { dining: 5, entertainment: 5, utilities: 5 },
      label: "Restaurants, entertainment, and utilities",
      cap: cap(1_500, "quarter"),
      requiresActivation: true,
    },
    highlights: ["5% in categories that rotate each quarter", "No annual fee", "No foreign transaction fees"],
    popularityRank: 10, visual: visual("#f97316", "#fdba74", "#431407"),
  },

  // ---------- Chase ----------
  {
    ...DEFAULTS,
    id: "chase-sapphire-preferred", name: "Sapphire Preferred", fullName: "Chase Sapphire Preferred",
    issuer: "Chase", network: "Visa", annualFeeCents: dollarsToCents(95), currency: "points", baseRate: 1,
    categoryRules: [
      rule("travel_portal", 5, { note: "Travel booked through Chase Travel" }),
      rule("dining", 3),
      rule("streaming", 3, { note: "Select streaming services" }),
      rule("travel", 2),
    ],
    // Online grocery only, so it is display-only rather than a groceries rate.
    merchantRules: [{ merchant: "Online grocery orders (not Target, Walmart, or wholesale clubs)", rate: 3 }],
    highlights: ["Transfer points to airline and hotel partners", "Annual hotel credit via Chase Travel", "Trip cancellation and rental car coverage"],
    popularityRank: 1, visual: visual("#0c2340", "#1e4b7a", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "chase-freedom-unlimited", name: "Freedom Unlimited", fullName: "Chase Freedom Unlimited",
    issuer: "Chase", network: "Visa", annualFeeCents: 0, currency: "points", baseRate: 1.5,
    categoryRules: [rule("dining", 3), rule("drugstores", 3), rule("travel_portal", 5, { note: "Travel booked through Chase Travel" })],
    highlights: ["1.5% on everything else", "Points combine with Sapphire cards"],
    popularityRank: 5, visual: visual("#1e3a8a", "#3b82f6", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "chase-freedom-flex", name: "Freedom Flex", fullName: "Chase Freedom Flex",
    issuer: "Chase", network: "Mastercard", annualFeeCents: 0, currency: "points", baseRate: 1,
    categoryRules: [rule("dining", 3), rule("drugstores", 3), rule("travel_portal", 5, { note: "Travel booked through Chase Travel" })],
    rotating: {
      quarter: "Q4 2026", startDate: "2026-10-01", endDate: "2026-12-31",
      rates: { dining: 7, groceries: 5 },
      label: "Restaurants and grocery stores (not Walmart or Target)",
      cap: cap(1_500, "quarter"),
      requiresActivation: true,
    },
    highlights: ["5% in categories that rotate each quarter", "Cell phone protection"],
    popularityRank: 12, visual: visual("#1d4ed8", "#60a5fa", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "chase-prime-visa", name: "Prime Visa", fullName: "Prime Visa",
    issuer: "Chase", network: "Visa", annualFeeCents: 0, currency: "points", baseRate: 1,
    categoryRules: [
      rule("amazon", 5),
      rule("travel_portal", 5, { note: "Travel booked through Chase Travel" }),
      rule("dining", 2),
      rule("gas", 2),
      rule("transit", 2, { note: "Local transit and commuting" }),
    ],
    requiresMembership: "Amazon Prime",
    highlights: ["5% at Amazon and Whole Foods with Prime", "No annual fee beyond Prime"],
    popularityRank: 14, visual: visual("#232f3e", "#37475a", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "chase-sapphire-reserve", name: "Sapphire Reserve", fullName: "Chase Sapphire Reserve",
    issuer: "Chase", network: "Visa", annualFeeCents: dollarsToCents(795), currency: "points", baseRate: 1,
    categoryRules: [
      rule("travel_portal", 8, { note: "Travel booked through Chase Travel" }),
      rule("travel", 4, { note: "Flights and hotels booked directly" }),
      rule("dining", 3),
    ],
    highlights: ["Annual travel credit", "Airport lounge access", "Transfer points to travel partners"],
    popularityRank: 15, visual: visual("#111827", "#374151", "#ffffff"),
  },

  // ---------- American Express ----------
  {
    ...DEFAULTS,
    id: "amex-gold", name: "Gold", fullName: "American Express Gold Card",
    issuer: "American Express", network: "Amex", annualFeeCents: dollarsToCents(325), currency: "points", baseRate: 1,
    categoryRules: [
      rule("dining", 4, { cap: cap(50_000, "year"), note: "Restaurants worldwide" }),
      rule("groceries", 4, { cap: cap(25_000, "year"), note: "U.S. supermarkets" }),
      rule("travel", 3, { note: "Flights booked directly with airlines" }),
      rule("travel_portal", 5, { note: "Prepaid hotels booked through Amex Travel" }),
    ],
    highlights: ["Monthly dining and Uber Cash credits", "Transfer points to airline and hotel partners"],
    popularityRank: 3, visual: visual("#b8860b", "#e6c46a", "#1f1300"),
  },
  {
    ...DEFAULTS,
    id: "amex-platinum", name: "Platinum", fullName: "The Platinum Card from American Express",
    issuer: "American Express", network: "Amex", annualFeeCents: dollarsToCents(895), currency: "points", baseRate: 1,
    categoryRules: [
      rule("travel", 5, { cap: cap(500_000, "year"), note: "Flights booked directly with airlines" }),
      rule("travel_portal", 5, { note: "Flights and prepaid hotels through Amex Travel" }),
    ],
    highlights: ["Airport lounge access", "Statement credits for travel, dining, and entertainment", "Hotel elite status"],
    popularityRank: 8, visual: visual("#9ca3af", "#f3f4f6", "#111827"),
  },
  {
    ...DEFAULTS,
    id: "amex-blue-cash-preferred", name: "Blue Cash Preferred", fullName: "Blue Cash Preferred Card from American Express",
    issuer: "American Express", network: "Amex", annualFeeCents: dollarsToCents(95), currency: "cash", baseRate: 1,
    categoryRules: [
      rule("groceries", 6, { cap: cap(6_000, "year"), note: "U.S. supermarkets" }),
      rule("streaming", 6, { note: "Select U.S. streaming subscriptions" }),
      rule("gas", 3, { note: "U.S. gas stations" }),
      rule("transit", 3),
    ],
    highlights: ["Monthly streaming bundle credit", "Purchase and return protection"],
    popularityRank: 13, visual: visual("#0e4c92", "#3a86d1", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "amex-blue-cash-everyday", name: "Blue Cash Everyday", fullName: "Blue Cash Everyday Card from American Express",
    issuer: "American Express", network: "Amex", annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: [
      rule("groceries", 3, { cap: cap(6_000, "year"), note: "U.S. supermarkets" }),
      rule("online_shopping", 3, { cap: cap(6_000, "year"), note: "U.S. online retail" }),
      rule("gas", 3, { cap: cap(6_000, "year"), note: "U.S. gas stations" }),
    ],
    highlights: ["No annual fee", "Monthly streaming bundle credit"],
    popularityRank: 18, visual: visual("#38bdf8", "#bae6fd", "#0c4a6e"),
  },

  // ---------- Citi ----------
  {
    ...DEFAULTS,
    id: "citi-double-cash", name: "Double Cash", fullName: "Citi Double Cash",
    issuer: "Citi", network: "Mastercard", annualFeeCents: 0, currency: "cash", baseRate: 2,
    categoryRules: [rule("travel_portal", 5, { note: "Hotels, car rentals, and attractions through Citi Travel" })],
    highlights: ["2% on everything: 1% when you buy, 1% as you pay", "No annual fee"],
    popularityRank: 6, visual: visual("#12355b", "#2f6fa8", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "citi-custom-cash", name: "Custom Cash", fullName: "Citi Custom Cash",
    issuer: "Citi", network: "Mastercard", annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: [rule("travel_portal", 4, { note: "Hotels, car rentals, and attractions through Citi Travel" })],
    selectable: {
      mode: "auto_top_spend", picks: 1,
      options: ["dining", "groceries", "gas", "travel", "transit", "streaming", "drugstores", "entertainment"],
      rate: 5, defaultChoices: ["dining"], cap: cap(500, "month"),
    },
    highlights: ["5% follows your top spending category each billing cycle", "No annual fee"],
    popularityRank: 16, visual: visual("#0b6e6e", "#3fb0a8", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "citi-costco-anywhere", name: "Costco Anywhere Visa", fullName: "Costco Anywhere Visa Card by Citi",
    issuer: "Citi", network: "Visa", annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: [
      rule("gas", 4, { cap: cap(7_000, "year"), note: "Gas and EV charging" }),
      rule("dining", 3),
      rule("travel", 3),
      rule("wholesale", 2, { note: "Costco and Costco.com" }),
    ],
    merchantRules: [{ merchant: "Costco gas", rate: 5 }],
    requiresMembership: "Costco membership",
    highlights: ["Rewards paid once a year as a Costco reward certificate", "No annual fee with a Costco membership"],
    popularityRank: 23, visual: visual("#374151", "#6b7280", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "citi-strata-premier", name: "Strata Premier", fullName: "Citi Strata Premier",
    issuer: "Citi", network: "Mastercard", annualFeeCents: dollarsToCents(95), currency: "points", baseRate: 1,
    categoryRules: [
      rule("travel_portal", 10, { note: "Hotels, car rentals, and attractions through Citi Travel" }),
      rule("travel", 3, { note: "Air travel and hotels" }),
      rule("dining", 3),
      rule("groceries", 3, { note: "Supermarkets" }),
      rule("gas", 3, { note: "Gas and EV charging" }),
    ],
    highlights: ["Annual hotel savings benefit", "Transfer points to travel partners"],
    popularityRank: 24, visual: visual("#1c2541", "#3a506b", "#ffffff"),
  },

  // ---------- Wells Fargo ----------
  {
    ...DEFAULTS,
    id: "wells-fargo-active-cash", name: "Active Cash", fullName: "Wells Fargo Active Cash",
    issuer: "Wells Fargo", network: "Visa", annualFeeCents: 0, currency: "cash", baseRate: 2,
    categoryRules: [],
    highlights: ["Unlimited 2% cash rewards", "Cell phone protection"],
    popularityRank: 9, visual: visual("#b91c1c", "#ef4444", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "wells-fargo-autograph", name: "Autograph", fullName: "Wells Fargo Autograph",
    issuer: "Wells Fargo", network: "Visa", annualFeeCents: 0, currency: "points", baseRate: 1,
    categoryRules: [
      rule("dining", 3),
      rule("travel", 3),
      rule("gas", 3),
      rule("transit", 3),
      rule("streaming", 3, { note: "Popular streaming services" }),
    ],
    // Phone plans only, so it is display-only rather than a utilities rate.
    merchantRules: [{ merchant: "Phone plans", rate: 3 }],
    highlights: ["No annual fee", "Cell phone protection"],
    popularityRank: 22, visual: visual("#3f3f46", "#a1a1aa", "#ffffff"),
  },

  // ---------- Bank of America ----------
  {
    ...DEFAULTS,
    id: "bofa-customized-cash", name: "Customized Cash", fullName: "Bank of America Customized Cash Rewards",
    issuer: "Bank of America", network: "Visa", annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: [
      rule("groceries", 2, { cap: bofaCap(["groceries"]) }),
      rule("wholesale", 2, { cap: bofaCap(["wholesale"]) }),
    ],
    selectable: {
      mode: "user_choice", picks: 1,
      options: ["gas", "online_shopping", "dining", "travel", "drugstores"],
      rate: 3, defaultChoices: ["dining"],
      cap: bofaCap(["gas", "online_shopping", "dining", "travel", "drugstores"]),
    },
    highlights: ["Change your 3% category once a month", "Preferred Rewards members can earn more"],
    popularityRank: 21, visual: visual("#7f1d1d", "#dc2626", "#ffffff"),
  },
  {
    ...DEFAULTS,
    id: "bofa-unlimited-cash", name: "Unlimited Cash", fullName: "Bank of America Unlimited Cash Rewards",
    issuer: "Bank of America", network: "Visa", annualFeeCents: 0, currency: "cash", baseRate: 1.5,
    categoryRules: [],
    highlights: ["Unlimited 1.5% cash back", "Preferred Rewards members can earn more"],
    popularityRank: 26, visual: visual("#9f1239", "#f43f5e", "#ffffff"),
  },

  // ---------- U.S. Bank ----------
  {
    ...DEFAULTS,
    id: "us-bank-cash-plus", name: "Cash+", fullName: "U.S. Bank Cash+ Visa Signature",
    issuer: "U.S. Bank", network: "Visa", annualFeeCents: 0, currency: "cash", baseRate: 1,
    categoryRules: [rule("groceries", 2, { note: "Everyday 2% category (groceries chosen)" })],
    selectable: {
      mode: "user_choice", picks: 2,
      options: ["utilities", "streaming", "transit", "entertainment", "dining"],
      rate: 5, defaultChoices: ["utilities", "streaming"],
      cap: cap(2_000, "quarter"),
    },
    highlights: ["Pick two 5% categories each quarter", "No annual fee"],
    popularityRank: 28, visual: visual("#1e293b", "#0ea5e9", "#ffffff"),
  },

  // ---------- Apple ----------
  {
    ...DEFAULTS,
    id: "apple-card", name: "Apple Card", fullName: "Apple Card",
    issuer: "Apple", network: "Mastercard", annualFeeCents: 0, currency: "cash",
    // Assumes Apple Pay; the physical card earns 1%.
    baseRate: 2,
    categoryRules: [],
    merchantRules: [
      { merchant: "Apple purchases", rate: 3 },
      { merchant: "Select Apple Pay merchants", rate: 3 },
      { merchant: "Purchases with the physical card", rate: 1 },
    ],
    highlights: ["Daily Cash paid every day", "No annual, late, or foreign transaction fees"],
    popularityRank: 17, visual: visual("#f5f5f7", "#e5e7eb", "#111827"),
  },
];

const byId = new Map(CARD_CATALOG.map(card => [card.id, card]));

export function findCard(id: string): CreditCard | undefined {
  return byId.get(id);
}

/** Cards in catalog order; unknown ids are dropped. */
export function cardsByIds(ids: readonly string[]): CreditCard[] {
  const wanted = new Set(ids);
  return CARD_CATALOG.filter(card => wanted.has(card.id));
}

/**
 * Old sample-card ids, still used by the seeded Nessie demo (data/nessie-demo/plan.json and the
 * credit-card account nicknames in Nessie). Each maps to the closest real card.
 */
export const LEGACY_CARD_IDS: Readonly<Record<string, string>> = {
  "everyday-1": "capital-one-quicksilver",
  "road-rewards": "amex-blue-cash-everyday",
  "market-fresh": "amex-blue-cash-everyday",
  "steady-2": "citi-double-cash",
  "dine-play": "capital-one-savor",
  "click-ship": "amex-blue-cash-everyday",
  "grocery-max": "amex-blue-cash-preferred",
  "travel-miles": "capital-one-venture",
  "premium-gold": "amex-gold",
};

/** A catalog id, or the real card a legacy sample id maps to; undefined when unknown. */
export function resolveCardId(id: string): string | undefined {
  if (byId.has(id)) return id;
  return Object.hasOwn(LEGACY_CARD_IDS, id) ? LEGACY_CARD_IDS[id] : undefined;
}

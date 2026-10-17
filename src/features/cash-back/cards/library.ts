// EDIT HERE. Card library for the Cash Back Maximizer.
// Nessie has no rewards data, so every card's rules live in this file. These are sample cards with
// illustrative rates, not current issuer offers. Rates are percent (points cards: points per dollar,
// worth 1 cent each); caps and fees are in dollars. normalizeCard converts them to bps and cents once.
// Run npm test after editing: the demo-lock test checks the demo story still holds.
import { dollarsToCents } from "../../../lib/money";
import type { CapPeriod, CardDefinition, Category } from "../types";

interface CardInput {
  id: string;
  name: string;
  rewardType: "cashback" | "points";
  basePercent: number;
  tiers: { categories: Category[]; percent: number; cap?: { dollars: number; period: CapPeriod } }[];
  annualFee: number;
  blurb: string;
}

const cards: CardInput[] = [
  {
    id: "everyday-1",
    name: "Everyday 1% Card",
    rewardType: "cashback",
    basePercent: 1,
    tiers: [],
    annualFee: 0,
    blurb: "1% on everything.",
  },
  {
    id: "road-rewards",
    name: "Road Rewards Visa",
    rewardType: "cashback",
    basePercent: 1,
    tiers: [{ categories: ["gas"], percent: 4, cap: { dollars: 400, period: "monthly" } }],
    annualFee: 0,
    blurb: "4% on gas up to $400 a month, then 1%.",
  },
  {
    id: "market-fresh",
    name: "Market Fresh Mastercard",
    rewardType: "cashback",
    basePercent: 1,
    tiers: [{ categories: ["groceries"], percent: 3, cap: { dollars: 300, period: "monthly" } }],
    annualFee: 0,
    blurb: "3% at grocery stores up to $300 a month, then 1%.",
  },
  {
    id: "steady-2",
    name: "Steady 2% Cash",
    rewardType: "cashback",
    basePercent: 2,
    tiers: [],
    annualFee: 0,
    blurb: "2% on everything, no categories to track.",
  },
  {
    id: "dine-play",
    name: "Dine & Play Card",
    rewardType: "cashback",
    basePercent: 1,
    tiers: [{ categories: ["dining", "entertainment", "streaming"], percent: 3 }],
    annualFee: 0,
    blurb: "3% on dining, entertainment, and streaming.",
  },
  {
    id: "click-ship",
    name: "Click & Ship Card",
    rewardType: "cashback",
    basePercent: 1,
    tiers: [
      { categories: ["online"], percent: 5, cap: { dollars: 1500, period: "quarterly" } },
      { categories: ["drugstores"], percent: 2 },
    ],
    annualFee: 0,
    blurb: "5% on online shopping up to $1,500 a quarter, 2% at drugstores.",
  },
  {
    id: "grocery-max",
    name: "Grocery Max Preferred",
    rewardType: "cashback",
    basePercent: 1,
    tiers: [
      { categories: ["groceries"], percent: 6, cap: { dollars: 1500, period: "quarterly" } },
      { categories: ["gas", "streaming"], percent: 3 },
    ],
    annualFee: 95,
    blurb: "6% at grocery stores up to $1,500 a quarter, 3% on gas and streaming.",
  },
  {
    id: "travel-miles",
    name: "Travel Miles Plus",
    rewardType: "points",
    basePercent: 2,
    tiers: [{ categories: ["travel"], percent: 5 }],
    annualFee: 95,
    blurb: "5x points on travel, 2x on everything else.",
  },
  {
    id: "premium-gold",
    name: "Premium Gold Rewards",
    rewardType: "points",
    basePercent: 1,
    tiers: [
      { categories: ["dining", "groceries"], percent: 4 },
      { categories: ["travel"], percent: 3 },
    ],
    annualFee: 325,
    blurb: "4x points on dining and groceries, 3x on travel.",
  },
];

function toBps(percent: number): number {
  const bps = Math.round(percent * 100);
  if (!Number.isSafeInteger(bps) || bps < 0) throw new Error(`Invalid reward rate ${percent}%.`);
  return bps;
}

export function normalizeCard(input: CardInput): CardDefinition {
  return {
    id: input.id,
    name: input.name,
    rewardType: input.rewardType,
    baseRateBps: toBps(input.basePercent),
    tiers: input.tiers.map(tier => ({
      categories: tier.categories,
      rateBps: toBps(tier.percent),
      ...(tier.cap ? { cap: { amountCents: dollarsToCents(tier.cap.dollars), period: tier.cap.period } } : {}),
    })),
    annualFeeCents: dollarsToCents(input.annualFee),
    blurb: input.blurb,
  };
}

export const CARD_LIBRARY: readonly CardDefinition[] = cards.map(normalizeCard);

const byId = new Map(CARD_LIBRARY.map(card => [card.id, card]));

export function findCard(id: string): CardDefinition | undefined {
  return byId.get(id);
}

/** Cards in library order; unknown ids are dropped. */
export function cardsByIds(ids: readonly string[]): CardDefinition[] {
  const wanted = new Set(ids);
  return CARD_LIBRARY.filter(card => wanted.has(card.id));
}

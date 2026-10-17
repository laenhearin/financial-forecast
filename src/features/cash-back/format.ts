import type { Bps, CardDefinition, CapPeriod, Category } from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  gas: "Gas",
  groceries: "Groceries",
  dining: "Dining",
  streaming: "Streaming",
  travel: "Travel",
  drugstores: "Drugstores",
  online: "Online shopping",
  entertainment: "Entertainment",
  other: "Everything else",
};

/** Lowercase label for use mid-sentence: "online shopping". */
export function categoryNoun(category: Category): string {
  return CATEGORY_LABELS[category].toLowerCase();
}

/** 400 -> "4", 150 -> "1.5", 225 -> "2.25". */
function rateNumber(bps: Bps): string {
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

/** Cash-back style: "4%". Points are worth 1 cent, so 4x points is also shown as 4% in totals. */
export function formatRate(bps: Bps): string {
  return `${rateNumber(bps)}%`;
}

/** How the card advertises it: "4%" for cash back, "4x points" for points cards. */
export function formatCardRate(bps: Bps, card: Pick<CardDefinition, "rewardType">): string {
  return card.rewardType === "points" ? `${rateNumber(bps)}x points` : formatRate(bps);
}

export function periodNoun(period: CapPeriod): string {
  return period === "monthly" ? "month" : "quarter";
}

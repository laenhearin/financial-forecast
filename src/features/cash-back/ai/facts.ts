import { isCents } from "../../../lib/money";
import { CARD_LIBRARY } from "../cards/library";
import { CATEGORIES, isCategory, type Bps, type CashBackAnalysis, type Category, type Cents, type WindowDays } from "../types";

/** The small, already-computed summary the narrator (template or AI) explains. No raw purchases. */
export interface AdviceFacts {
  windowDays: WindowDays;
  actualCents: Cents;
  bestCents: Cents;
  missedCents: Cents;
  missedAnnualCents: Cents;
  /** Wrong-card spending grouped by category and better card, biggest miss first. */
  topMisses: MissGroup[];
  /** Best card per category with spending, largest spend first. */
  playbook: { category: Category; cardName: string; rateBps: Bps }[];
  suggestion: { cardName: string; annualFeeCents: Cents; gainAnnualCents: Cents; netAnnualCents: Cents } | null;
}

export interface MissGroup {
  category: Category;
  usedCardNames: string[];
  betterCardName: string;
  betterRateBps: Bps;
  spentCents: Cents;
  missedCents: Cents;
  count: number;
}

export const MAX_MISS_GROUPS = 3;
export const MAX_PLAYBOOK_FACTS = CATEGORIES.length;

export function buildAdviceFacts(analysis: CashBackAnalysis, includeSuggestion: boolean): AdviceFacts {
  const groups = new Map<string, MissGroup>();
  for (const flag of analysis.flags) {
    const key = `${flag.category}|${flag.betterCardId}`;
    const group = groups.get(key) ?? {
      category: flag.category, usedCardNames: [], betterCardName: flag.betterCardName, betterRateBps: flag.betterRateBps,
      spentCents: 0, missedCents: 0, count: 0,
    };
    if (!group.usedCardNames.includes(flag.usedCardName)) group.usedCardNames.push(flag.usedCardName);
    group.spentCents += flag.amountCents;
    group.missedCents += flag.missedCents;
    group.count += 1;
    groups.set(key, group);
  }
  const suggestion = includeSuggestion ? analysis.suggestion.suggestion : null;
  return {
    windowDays: analysis.windowDays,
    actualCents: analysis.rewards.actualCents,
    bestCents: analysis.rewards.bestCents,
    missedCents: analysis.rewards.missedCents,
    missedAnnualCents: analysis.missedAnnualCents,
    topMisses: [...groups.values()].sort((a, b) => b.missedCents - a.missedCents).slice(0, MAX_MISS_GROUPS),
    playbook: analysis.playbook
      .filter(entry => entry.spendCents > 0)
      .slice(0, MAX_PLAYBOOK_FACTS)
      .map(entry => ({ category: entry.category, cardName: entry.primary.cardName, rateBps: entry.primary.rateBps })),
    suggestion: suggestion && {
      cardName: suggestion.cardName,
      annualFeeCents: suggestion.annualFeeCents,
      gainAnnualCents: suggestion.gainAnnualCents,
      netAnnualCents: suggestion.netAnnualCents,
    },
  };
}

// ---------- Validation for the advice route (the body comes from the browser) ----------

const CARD_NAMES = new Set(CARD_LIBRARY.map(card => card.name));
const MAX_ABS_CENTS = 100_000_000_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAmount(value: unknown): value is number {
  return isCents(value) && Math.abs(value) <= MAX_ABS_CENTS;
}
function isRate(value: unknown): value is number {
  return isCents(value) && value >= 0 && value <= 10_000;
}
/** Card names must come from the library, so free text never reaches the model through this route. */
function isCardName(value: unknown): value is string {
  return typeof value === "string" && CARD_NAMES.has(value);
}

/** Strictly checks an AdviceFacts payload. Returns a clean copy, or null if anything is off. */
export function parseAdviceFacts(value: unknown): AdviceFacts | null {
  if (!isObject(value)) return null;
  const { windowDays, actualCents, bestCents, missedCents, missedAnnualCents, topMisses, playbook, suggestion } = value;
  if (windowDays !== 30 && windowDays !== 90) return null;
  if (![actualCents, bestCents, missedCents, missedAnnualCents].every(isAmount)) return null;
  if (!Array.isArray(topMisses) || topMisses.length > MAX_MISS_GROUPS) return null;
  if (!Array.isArray(playbook) || playbook.length > MAX_PLAYBOOK_FACTS) return null;

  const misses: MissGroup[] = [];
  for (const item of topMisses) {
    if (!isObject(item)) return null;
    const { category, usedCardNames, betterCardName, betterRateBps, spentCents, missedCents: missed, count } = item;
    if (!isCategory(category) || !isCardName(betterCardName) || !isRate(betterRateBps)) return null;
    if (!Array.isArray(usedCardNames) || usedCardNames.length === 0 || usedCardNames.length > CARD_LIBRARY.length || !usedCardNames.every(isCardName)) return null;
    if (!isAmount(spentCents) || !isAmount(missed) || !Number.isSafeInteger(count) || (count as number) < 1) return null;
    misses.push({ category, usedCardNames: [...usedCardNames], betterCardName, betterRateBps, spentCents, missedCents: missed, count: count as number });
  }

  const plays: AdviceFacts["playbook"] = [];
  for (const item of playbook) {
    if (!isObject(item) || !isCategory(item.category) || !isCardName(item.cardName) || !isRate(item.rateBps)) return null;
    plays.push({ category: item.category, cardName: item.cardName, rateBps: item.rateBps });
  }

  let cleanSuggestion: AdviceFacts["suggestion"] = null;
  if (suggestion !== null) {
    if (!isObject(suggestion) || !isCardName(suggestion.cardName)) return null;
    const { annualFeeCents, gainAnnualCents, netAnnualCents } = suggestion;
    if (!isAmount(annualFeeCents) || !isAmount(gainAnnualCents) || !isAmount(netAnnualCents)) return null;
    cleanSuggestion = { cardName: suggestion.cardName, annualFeeCents, gainAnnualCents, netAnnualCents };
  }

  return {
    windowDays, actualCents: actualCents as number, bestCents: bestCents as number, missedCents: missedCents as number,
    missedAnnualCents: missedAnnualCents as number, topMisses: misses, playbook: plays, suggestion: cleanSuggestion,
  };
}

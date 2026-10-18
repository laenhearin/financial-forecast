import { clean } from "@/lib/ai/schemas";
import type { AiMeta } from "@/lib/ai/types";
import { formatUSD } from "@/lib/money";
import { CARD_CATALOG, findCard } from "../cards/catalog";
import { compareCardList, MAX_COMPARE_CARDS, type CardComparison } from "../engine/compare";
import { isValidChoice } from "../engine/rewards";
import { brandedName, CATEGORY_LABELS, formatRate, joinWords } from "../format";
import type { CategoryId, Cents, CreditCard, SpendProfile } from "../types";

// The AI overview for the card comparison. Client and server safe: request validation, the facts
// the model sees, the template used whenever the model can't answer, and the output validator.

/** What the browser sends: inputs only. The server reloads the profile and recomputes the comparison. */
export interface CompareRequest {
  cardIds: string[];
  ownedCardIds: string[];
  /** user_choice picks for compared cards, as saved on this page. */
  selections: Record<string, CategoryId[]>;
}

export interface CompareOverview {
  headline: string;
  overview: string;
  watchOut: string | null;
}

export type CompareResponse =
  | { status: "ok"; overview: CompareOverview; meta: AiMeta }
  | { status: "error"; message: string };

function plainObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Known catalog ids only, de-duplicated; null on anything else. */
function cardIdList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  if (!value.every((id): id is string => typeof id === "string" && findCard(id) !== undefined)) return null;
  return [...new Set(value)];
}

/** Accepts { cardIds, ownedCardIds, selections? }: two or three compared cards. Unknown keys are rejected. */
export function parseCompareRequest(value: unknown): CompareRequest | null {
  const body = plainObject(value);
  if (!body || Object.keys(body).some(key => !["cardIds", "ownedCardIds", "selections"].includes(key))) return null;
  const cardIds = cardIdList(body.cardIds, MAX_COMPARE_CARDS);
  const ownedCardIds = cardIdList(body.ownedCardIds, CARD_CATALOG.length);
  if (!cardIds || cardIds.length < 2 || !ownedCardIds) return null;

  const selections: Record<string, CategoryId[]> = {};
  if (body.selections !== undefined) {
    const raw = plainObject(body.selections);
    if (!raw) return null;
    for (const [cardId, choice] of Object.entries(raw)) {
      const block = cardIds.includes(cardId) ? findCard(cardId)?.selectable : undefined;
      if (block?.mode !== "user_choice" || !Array.isArray(choice) || !isValidChoice(block, choice)) return null;
      selections[cardId] = [...choice];
    }
  }
  return { cardIds, ownedCardIds, selections };
}

/** Only the picks for the compared cards, so the request stays small. */
export function selectionsFor(cardIds: readonly string[], selections: Readonly<Record<string, readonly CategoryId[]>>): Record<string, CategoryId[]> {
  return Object.fromEntries(cardIds.filter(id => selections[id] && findCard(id)?.selectable?.mode === "user_choice").map(id => [id, [...selections[id]]]));
}

// ---------- Facts ----------

export interface CompareCardFacts {
  name: string;
  issuer: string;
  rewardType: "cash back" | "points" | "miles";
  annualFeeCents: Cents;
  /** As if it were the only card used for everything, before the fee. */
  yearlyRewardsCents: Cents;
  netAfterFeeCents: Cents;
  /** "2%"; null without spending. */
  returnOnSpending: string | null;
  bestCategories: string[];
  alreadyHave: boolean;
  /** Net yearly gain from adding it to the cards the user has; null when they already have it. */
  netGainIfAddedCents: Cents | null;
  requiresMembership: string | null;
  rotatingCategoriesNeedActivation: boolean;
  businessCard: boolean;
  studentCard: boolean;
  /** Short catalog perks, display copy only. */
  perks: string[];
}

export interface CompareFacts {
  yearlySpendCents: Cents;
  monthlySpend: Array<{ category: string; monthlySpendCents: Cents }>;
  cards: CompareCardFacts[];
  /** The engine's pick: most left after the annual fee. */
  bestOnYourSpending: string;
  leadOverNextCents: Cents;
}

const REWARD_TYPE: Record<CreditCard["currency"], CompareCardFacts["rewardType"]> = { cash: "cash back", points: "points", miles: "miles" };

/** Facts for the overview, straight from the comparison. Null with fewer than two cards. Card and category names only; no customer data. */
export function compareFacts(comparison: CardComparison, spendProfile: SpendProfile): CompareFacts | null {
  const cards = compareCardList(comparison.cards.map(item => item.cardId));
  const best = comparison.bestCardId ? findCard(comparison.bestCardId) : undefined;
  if (!best || comparison.marginCents === null || cards.length !== comparison.cards.length) return null;
  return {
    yearlySpendCents: comparison.yearlySpendCents,
    monthlySpend: comparison.rows.map(row => ({ category: CATEGORY_LABELS[row.category], monthlySpendCents: spendProfile[row.category] ?? 0 })),
    cards: comparison.cards.map((item, index) => {
      const card = cards[index];
      return {
        name: brandedName(card),
        issuer: card.issuer,
        rewardType: REWARD_TYPE[card.currency],
        annualFeeCents: item.annualFeeCents,
        yearlyRewardsCents: item.yearlyRewardsCents,
        netAfterFeeCents: item.netCents,
        returnOnSpending: item.returnBps === null ? null : formatRate(item.returnBps),
        bestCategories: item.topCategories.map(category => CATEGORY_LABELS[category]),
        alreadyHave: item.owned,
        netGainIfAddedCents: item.addedNetCents,
        requiresMembership: card.requiresMembership ?? null,
        rotatingCategoriesNeedActivation: card.rotating?.requiresActivation === true,
        businessCard: card.isBusiness,
        studentCard: card.isStudent,
        perks: card.highlights,
      };
    }),
    bestOnYourSpending: brandedName(best),
    leadOverNextCents: comparison.marginCents,
  };
}

// ---------- Template ----------

/** "$240 a year after its $95 fee" or "$240 a year with no annual fee". */
function netPhrase(card: CompareCardFacts): string {
  const fee = card.annualFeeCents > 0 ? `after its ${formatUSD(card.annualFeeCents)} annual fee` : "with no annual fee";
  return `${formatUSD(card.netAfterFeeCents)} a year ${fee}`;
}

/** Deterministic overview from the same facts the model gets. Reads as normal product copy. */
export function compareTemplate(facts: CompareFacts): CompareOverview {
  const best = facts.cards.find(card => card.name === facts.bestOnYourSpending) ?? facts.cards[0];
  const others = facts.cards.filter(card => card !== best);
  if (facts.yearlySpendCents === 0) {
    return {
      headline: "No spending to compare yet",
      overview: `This profile has no monthly spending estimate, so none of these cards earns rewards yet. With no spending, ${best.name} costs the least to keep.`,
      watchOut: null,
    };
  }

  const sentences = [`On your spending, ${best.name} comes out ahead at ${netPhrase(best)}.`];
  sentences.push(facts.leadOverNextCents > 0
    ? `That's ${formatUSD(facts.leadOverNextCents)} a year more than ${others[0] ? nextBest(others).name : "the next card"}.`
    : `It ties with ${nextBest(others).name}; the lower fee or wider acceptance can decide it.`);
  if (best.bestCategories.length) sentences.push(`Most of its rewards come from ${joinWords(best.bestCategories.map(name => name.toLowerCase()))}.`);
  if (best.alreadyHave) sentences.push("You already have it, so keep using it where it leads.");
  else if (best.netGainIfAddedCents !== null && best.netGainIfAddedCents > 0) sentences.push(`Added to the cards you have, it would bring in about ${formatUSD(best.netGainIfAddedCents)} more a year.`);

  return { headline: `${best.name} earns the most on your spending`, overview: sentences.join(" "), watchOut: watchOutText(facts.cards) };
}

function nextBest(cards: readonly CompareCardFacts[]): CompareCardFacts {
  return [...cards].sort((a, b) => b.netAfterFeeCents - a.netAfterFeeCents)[0];
}

/** The first catch worth knowing about: a fee the rewards don't cover, a membership, activation, or a business card. */
function watchOutText(cards: readonly CompareCardFacts[]): string | null {
  const feeLoss = cards.find(card => card.annualFeeCents > 0 && card.netAfterFeeCents < 0);
  if (feeLoss) return `${feeLoss.name}'s ${formatUSD(feeLoss.annualFeeCents)} fee is more than it earns on your spending, so it only pays off if you use its perks.`;
  const member = cards.find(card => card.requiresMembership);
  if (member) return `${member.name} requires ${member.requiresMembership}.`;
  const rotating = cards.find(card => card.rotatingCategoriesNeedActivation);
  if (rotating) return `${rotating.name}'s bonus categories rotate and need activating each quarter.`;
  const business = cards.find(card => card.businessCard);
  if (business) return `${business.name} is a business card.`;
  return null;
}

// ---------- Model output ----------

export const COMPARE_LIMITS = { headline: 90, overview: 700, watchOut: 260 };

export function parseCompareOverview(data: unknown): CompareOverview | null {
  const body = plainObject(data);
  if (!body) return null;
  const headline = clean(body.headline, COMPARE_LIMITS.headline);
  const overview = clean(body.overview, COMPARE_LIMITS.overview);
  if (!headline || !overview) return null;
  if (body.watchOut === null || body.watchOut === undefined || (typeof body.watchOut === "string" && !body.watchOut.trim())) {
    return { headline, overview, watchOut: null };
  }
  const watchOut = clean(body.watchOut, COMPARE_LIMITS.watchOut);
  return watchOut ? { headline, overview, watchOut } : null;
}

// ---------- Browser ----------

/** Asks the server for the overview. Throws with the server's message on any failure. */
export async function fetchCompareOverview(request: CompareRequest, signal?: AbortSignal): Promise<{ overview: CompareOverview; meta: AiMeta }> {
  const response = await fetch("/api/cash-back/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  let body: Partial<CompareResponse> & { message?: unknown } = {};
  try {
    body = await response.json() as typeof body;
  } catch { /* handled below */ }
  if (response.ok && body.status === "ok" && body.overview && body.meta) return { overview: body.overview, meta: body.meta };
  throw new Error(typeof body.message === "string" ? body.message : `The overview request failed (${response.status}).`);
}

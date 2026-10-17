import { CARD_CATALOG, cardsByIds } from "../cards/catalog";
import type { CreditCard, ISODate, Selections, SpendProfile } from "../types";
import {
  bestCardsByCategory, evaluateCandidates, goldCards, projectWalletRewards, rankSuggestions,
  type CardCandidate, type CategoryWinner, type GoldCard, type WalletProjection,
} from "./rewards";

export interface WalletInput {
  ownedCardIds: readonly string[];
  spendProfile: SpendProfile;
  today: ISODate;
  selections?: Selections;
  /** Suggestions the user said "Not interested" to. */
  dismissedSuggestions?: readonly string[];
  catalog?: readonly CreditCard[];
}

export interface WalletAnalysis {
  owned: CreditCard[];
  projection: WalletProjection;
  winners: CategoryWinner[];
  /** Owned cards that win a category with spend, by the monthly spend they win. */
  gold: GoldCard[];
  /** What each card the user doesn't own would add, by card id. */
  candidates: ReadonlyMap<string, CardCandidate>;
  /** Up to 3 suggestions, best first, without dismissed cards. */
  suggestions: CardCandidate[];
}

export const SUGGESTION_LIMIT = 3;

/** Everything the Cash Back page and the homepage card show, from one set of inputs. Pure and deterministic. */
export function analyzeWallet({ ownedCardIds, spendProfile, today, selections, dismissedSuggestions = [], catalog = CARD_CATALOG }: WalletInput): WalletAnalysis {
  const owned = cardsByIds(ownedCardIds);
  const options = { selections };
  const winners = bestCardsByCategory(owned, spendProfile, today, options);
  const candidates = evaluateCandidates(owned, catalog, spendProfile, today, options);
  return {
    owned,
    projection: projectWalletRewards(owned, spendProfile, today, options),
    winners,
    gold: goldCards(winners),
    candidates: new Map(candidates.map(candidate => [candidate.cardId, candidate])),
    suggestions: rankSuggestions(candidates, catalog, SUGGESTION_LIMIT, dismissedSuggestions),
  };
}

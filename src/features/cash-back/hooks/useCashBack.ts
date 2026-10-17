"use client";

import { useMemo, useSyncExternalStore } from "react";
import { loadDemoProfile } from "../data/source";
import { analyzeWallet } from "../engine/analyze";
import type { OwnershipFilter, SortMode } from "../engine/table";
import { prefsStore } from "../state/prefsStore";
import type { CategoryId } from "../types";

const profile = loadDemoProfile();

/**
 * Saved preferences plus everything computed from them. `prefs` and `analysis` are null on the server
 * and during hydration (local storage is client only), so callers show a skeleton until then.
 */
export function useCashBack() {
  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.getSnapshot, prefsStore.getServerSnapshot);
  const analysis = useMemo(
    () => prefs && analyzeWallet({
      ownedCardIds: prefs.ownedCardIds,
      spendProfile: profile.spendProfile,
      today: profile.asOfDate,
      selections: prefs.selections,
      dismissedSuggestions: prefs.dismissedSuggestions,
    }),
    [prefs],
  );

  const actions = {
    addCard(cardId: string) {
      prefsStore.update(current => (current.ownedCardIds.includes(cardId) ? current : { ...current, ownedCardIds: [...current.ownedCardIds, cardId] }));
    },
    removeCard(cardId: string) {
      prefsStore.update(current => ({ ...current, ownedCardIds: current.ownedCardIds.filter(id => id !== cardId) }));
    },
    setSelection(cardId: string, choice: CategoryId[]) {
      prefsStore.update(current => ({ ...current, selections: { ...current.selections, [cardId]: choice } }));
    },
    dismissSuggestion(cardId: string) {
      prefsStore.update(current => ({ ...current, dismissedSuggestions: [...new Set([...current.dismissedSuggestions, cardId])] }));
    },
    restoreSuggestions() {
      prefsStore.update(current => ({ ...current, dismissedSuggestions: [] }));
    },
    setSort(sort: SortMode) {
      prefsStore.update(current => ({ ...current, sort }));
    },
    setOwnershipFilter(ownershipFilter: OwnershipFilter) {
      prefsStore.update(current => ({ ...current, ownershipFilter }));
    },
    setShowBusiness(showBusiness: boolean) {
      prefsStore.update(current => ({ ...current, showBusiness }));
    },
  };

  return { profile, prefs, analysis, actions };
}

export type CashBackModel = ReturnType<typeof useCashBack>;

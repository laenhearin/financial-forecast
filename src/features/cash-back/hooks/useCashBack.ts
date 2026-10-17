"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CashBackProfile } from "../data/source";
import { analyzeWallet } from "../engine/analyze";
import type { OwnershipFilter, SortMode } from "../engine/table";
import { prefsStore } from "../state/prefsStore";
import type { CategoryId } from "../types";

/**
 * Saved preferences plus everything computed from them. `prefs` and `analysis` are null on the server
 * and during hydration (local storage is client only), so callers show a skeleton until then.
 */
export function useCashBack(profile: CashBackProfile, profileSlug: string) {
  const getSnapshot = useCallback(() => prefsStore.getSnapshot(profileSlug, profile.ownedCardIds), [profileSlug, profile.ownedCardIds]);
  const prefs = useSyncExternalStore(prefsStore.subscribe, getSnapshot, prefsStore.getServerSnapshot);
  const update: typeof prefsStore.update = change => prefsStore.update(change, profileSlug, profile.ownedCardIds);
  const analysis = useMemo(
    () => prefs && analyzeWallet({
      ownedCardIds: prefs.ownedCardIds,
      spendProfile: profile.spendProfile,
      today: profile.asOfDate,
      selections: prefs.selections,
      dismissedSuggestions: prefs.dismissedSuggestions,
    }),
    [prefs, profile],
  );

  const actions = {
    addCard(cardId: string) {
      update(current => (current.ownedCardIds.includes(cardId) ? current : { ...current, ownedCardIds: [...current.ownedCardIds, cardId] }));
    },
    removeCard(cardId: string) {
      update(current => ({ ...current, ownedCardIds: current.ownedCardIds.filter(id => id !== cardId) }));
    },
    setSelection(cardId: string, choice: CategoryId[]) {
      update(current => ({ ...current, selections: { ...current.selections, [cardId]: choice } }));
    },
    dismissSuggestion(cardId: string) {
      update(current => ({ ...current, dismissedSuggestions: [...new Set([...current.dismissedSuggestions, cardId])] }));
    },
    restoreSuggestions() {
      update(current => ({ ...current, dismissedSuggestions: [] }));
    },
    setSort(sort: SortMode) {
      update(current => ({ ...current, sort }));
    },
    setOwnershipFilter(ownershipFilter: OwnershipFilter) {
      update(current => ({ ...current, ownershipFilter }));
    },
    setShowBusiness(showBusiness: boolean) {
      update(current => ({ ...current, showBusiness }));
    },
  };

  return { profile, prefs, analysis, actions };
}

export type CashBackModel = ReturnType<typeof useCashBack>;

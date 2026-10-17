"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useActiveCustomerId } from "@/components/layout/ActiveCustomer";
import type { CashBackProfile } from "../data/source";
import { analyzeWallet } from "../engine/analyze";
import type { OwnershipFilter, SortMode } from "../engine/table";
import { prefsStore, resolvePrefs, type SavedCashBackPrefs } from "../state/prefsStore";
import type { CategoryId } from "../types";

/**
 * The active customer's saved preferences plus everything computed from them and their Nessie
 * profile. `prefs` and `analysis` are null on the server and during hydration (local storage is
 * client only), so callers show a skeleton until then.
 */
export function useCashBack(profile: CashBackProfile) {
  const customerId = useActiveCustomerId();
  const saved = useSyncExternalStore(prefsStore.subscribe, () => prefsStore.getSnapshot(customerId), prefsStore.getServerSnapshot);
  const prefs = useMemo(() => saved && resolvePrefs(saved, profile.ownedCardIds), [saved, profile.ownedCardIds]);
  const analysis = useMemo(
    () => prefs && analyzeWallet({
      ownedCardIds: prefs.ownedCardIds,
      spendProfile: profile.spendProfile,
      today: profile.asOfDate,
      selections: prefs.selections,
      dismissedSuggestions: prefs.dismissedSuggestions,
    }),
    [prefs, profile.spendProfile, profile.asOfDate],
  );

  const update = (change: (current: SavedCashBackPrefs) => SavedCashBackPrefs) => prefsStore.update(customerId, change);
  const ownedNow = (current: SavedCashBackPrefs) => current.ownedCardIds ?? [...profile.ownedCardIds];
  const actions = {
    addCard(cardId: string) {
      update(current => (ownedNow(current).includes(cardId) ? current : { ...current, ownedCardIds: [...ownedNow(current), cardId] }));
    },
    removeCard(cardId: string) {
      update(current => ({ ...current, ownedCardIds: ownedNow(current).filter(id => id !== cardId) }));
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

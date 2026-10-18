"use client";

import { useRef, useState } from "react";
import { Database } from "lucide-react";
import { DebtSummary } from "@/components/home/DebtSummary";
import { cashBackSpendNote, nessieSourceNote } from "@/lib/data-source";
import type { Scenario } from "../../big-purchase/types";
import { findCard } from "../cards/catalog";
import type { CashBackProfile } from "../data/source";
import { useCashBack } from "../hooks/useCashBack";
import { CardDrawer } from "./CardDrawer";
import { CardTable } from "./CardTable";
import { LineupPanel } from "./LineupPanel";
import { SummaryStrip } from "./SummaryStrip";
import { SuggestionPanel } from "./SuggestionPanel";

/**
 * Summary strip, the user's card lineup beside one suggestion, and a card table that scrolls inside
 * its own box (about ten rows tall).
 */
export function CashBackApp({ profile: nessieProfile, scenario, initialCardId }: { profile: CashBackProfile; scenario: Scenario; initialCardId: string | null }) {
  const { profile, prefs, analysis, actions } = useCashBack(nessieProfile);
  const [drawerCardId, setDrawerCardId] = useState<string | null>(initialCardId && findCard(initialCardId) ? initialCardId : null);
  const suggestionRef = useRef<HTMLElement>(null);

  const showSuggestion = () => {
    const panel = suggestionRef.current;
    if (!panel) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    panel.focus({ preventScroll: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-4 px-5 py-6 md:px-8 lg:py-7">
      <header className="shrink-0 text-center">
        <h1 className="page-title">Swipe and Shine</h1>
        <p className="mt-0.5 text-body text-secondary">Use the right card for every purchase.</p>
        <p className="mt-1 flex items-start justify-center gap-1.5 text-micro text-secondary">
          <Database aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={1.75} />
          {nessieSourceNote(profile.customerName, profile.asOfDate)} {cashBackSpendNote(scenario)}
        </p>
      </header>
      <DebtSummary scenario={scenario} />

      {!prefs || !analysis ? (
        <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {[0, 1].map(i => <div key={i} className="h-56 animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" />)}
          </div>
          <div className="h-206 max-h-[90dvh] animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" />
        </div>
      ) : (
        <>
          <SummaryStrip analysis={analysis} onShowSuggestion={showSuggestion} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <LineupPanel analysis={analysis} today={profile.asOfDate} onOpen={setDrawerCardId} />
            <SuggestionPanel
              ref={suggestionRef}
              analysis={analysis}
              hasDismissed={prefs.dismissedSuggestions.length > 0}
              onView={setDrawerCardId}
              onDismiss={actions.dismissSuggestion}
              onRestore={actions.restoreSuggestions}
            />
          </div>
          <CardTable
            analysis={analysis}
            prefs={prefs}
            today={profile.asOfDate}
            spendProfile={profile.spendProfile}
            onOpen={setDrawerCardId}
            onAdd={actions.addCard}
            onRemove={actions.removeCard}
            onSort={actions.setSort}
            onOwnership={actions.setOwnershipFilter}
            onShowBusiness={actions.setShowBusiness}
          />
          <CardDrawer
            cardId={drawerCardId}
            analysis={analysis}
            prefs={prefs}
            spendProfile={profile.spendProfile}
            onClose={() => setDrawerCardId(null)}
            onAdd={actions.addCard}
            onRemove={actions.removeCard}
            onSelect={actions.setSelection}
          />
        </>
      )}
    </div>
  );
}

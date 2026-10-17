"use client";

import { useRef, useState } from "react";
import { Database } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { findCard } from "../cards/catalog";
import { useCashBack } from "../hooks/useCashBack";
import { CardDrawer } from "./CardDrawer";
import { CardTable } from "./CardTable";
import { SummaryStrip } from "./SummaryStrip";
import { SuggestionPanel } from "./SuggestionPanel";

/**
 * Summary strip, one suggestion, and a card table that scrolls inside its own box. On wide screens
 * the page fits the viewport, so only the table scrolls.
 */
export function CashBackApp({ initialCardId }: { initialCardId: string | null }) {
  const { profile, prefs, analysis, actions } = useCashBack();
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
    <div className="mx-auto flex w-full max-w-350 flex-col gap-4 px-5 py-6 md:px-8 lg:h-dvh lg:min-h-180 lg:py-7">
      <header className="shrink-0">
        <h1 className="text-display font-medium text-primary">Swipe and Shine</h1>
        <p className="mt-0.5 text-body text-secondary">Use the right card for every purchase.</p>
        {profile.isFixture && (
          <p className="mt-1 flex items-center gap-1.5 text-micro text-secondary">
            <Database aria-hidden className="size-3.5" strokeWidth={1.75} />
            {profile.sourceLabel}: {profile.customerName}&apos;s typical monthly spending, as of {formatDate(profile.asOfDate, "full")}. Not live bank data.
          </p>
        )}
      </header>

      {!prefs || !analysis ? (
        <div aria-busy="true" aria-label="Loading" className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid shrink-0 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" />)}
          </div>
          <div className="h-28 shrink-0 animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" />
          <div className="min-h-90 flex-1 animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" />
        </div>
      ) : (
        <>
          <div className="shrink-0">
            <SummaryStrip analysis={analysis} onShowSuggestion={showSuggestion} />
          </div>
          <div className="shrink-0">
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
            className="lg:min-h-90 lg:flex-1"
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

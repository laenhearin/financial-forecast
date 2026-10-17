"use client";

import { useState, type Ref } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { findCard } from "../cards/catalog";
import type { WalletAnalysis } from "../engine/analyze";
import type { CardCandidate } from "../engine/rewards";
import { brandedName, CATEGORY_SHORT_LABELS, formatYearlyGain } from "../format";
import { CardArt } from "./CardArt";
import { buttonClass, ghostButtonClass, panelClass, primaryButtonClass } from "./ui";

function feeText(candidate: CardCandidate): string {
  return candidate.annualFeeCents > 0 ? `after the ${formatUSD(candidate.annualFeeCents)} annual fee` : "no annual fee";
}

function takesOverText(candidate: CardCandidate): string {
  return candidate.takesOver.map(category => CATEGORY_SHORT_LABELS[category]).join(", ");
}

interface SuggestionPanelProps {
  analysis: WalletAnalysis;
  hasDismissed: boolean;
  onView: (cardId: string) => void;
  onDismiss: (cardId: string) => void;
  onRestore: () => void;
  ref?: Ref<HTMLElement>;
}

/** The best card the user doesn't own, by net yearly gain, plus up to two more ideas. */
export function SuggestionPanel({ analysis, hasDismissed, onView, onDismiss, onRestore, ref }: SuggestionPanelProps) {
  const [showMore, setShowMore] = useState(false);
  const [top, ...more] = analysis.suggestions;
  const card = top ? findCard(top.cardId) : undefined;

  return (
    <section ref={ref} tabIndex={-1} aria-labelledby="cb-suggestion-title" className={cn(panelClass, "scroll-mt-4 px-5 py-4")}>
      <h2 id="cb-suggestion-title" className="flex items-center gap-1.5 text-caption font-medium text-secondary">
        <Lightbulb aria-hidden className="size-4 text-gold" strokeWidth={1.75} /> Suggestion
      </h2>

      {top && card ? (
        <>
          <div className="mt-2.5 flex flex-wrap items-start gap-x-4 gap-y-3">
            <CardArt card={card} size="md" className="max-sm:hidden" />
            <CardArt card={card} size="sm" className="sm:hidden" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-lead font-semibold text-primary">{brandedName(card)}</span>
                <span className="text-caption text-secondary">{card.issuer}</span>
              </p>
              <p className="mt-0.5 text-body text-primary">
                <span className="font-semibold text-pos">{formatYearlyGain(top.netGainCents)}</span> {feeText(top)}
              </p>
              {top.takesOver.length > 0 && <p className="mt-0.5 text-caption text-secondary">Takes over: {takesOverText(top)}</p>}
              {top.requiresMembership && <p className="mt-0.5 text-caption text-secondary">Requires {top.requiresMembership}</p>}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:self-center">
              <button type="button" className={primaryButtonClass} onClick={() => onView(card.id)}>View card</button>
              <button type="button" className={buttonClass} onClick={() => { onDismiss(card.id); }}>Not interested</button>
              {more.length > 0 && (
                <button
                  type="button"
                  className={ghostButtonClass}
                  aria-expanded={showMore}
                  aria-controls="cb-more-ideas"
                  onClick={() => setShowMore(open => !open)}
                >
                  {more.length} more {more.length === 1 ? "idea" : "ideas"}
                  <ChevronDown aria-hidden className={cn("size-4 motion-safe:transition-transform", showMore && "rotate-180")} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
          {more.length > 0 && showMore && (
            <ul id="cb-more-ideas" className="mt-3">
              {more.map(item => {
                const other = findCard(item.cardId);
                if (!other) return null;
                return (
                  <li key={item.cardId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-app py-2">
                    <CardArt card={other} size="sm" />
                    <span className="text-body font-medium text-primary">{brandedName(other)}</span>
                    <span className="text-body font-semibold text-pos">{formatYearlyGain(item.netGainCents)}</span>
                    <span className="min-w-0 flex-1 truncate text-caption text-secondary">
                      {feeText(item)}{item.takesOver.length > 0 && ` · Takes over: ${takesOverText(item)}`}
                    </span>
                    <button type="button" className={ghostButtonClass} onClick={() => onView(other.id)} aria-label={`View ${brandedName(other)}`}>View</button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-2 text-body text-primary">
          Your wallet already covers your spending well.
          {hasDismissed && (
            <button type="button" className="ml-2 text-caption font-medium text-accent underline-offset-4 hover:underline" onClick={onRestore}>
              Show dismissed ideas
            </button>
          )}
        </p>
      )}
      <p className="mt-2 text-micro text-secondary">Estimate from your spending. Not an offer of credit.</p>
    </section>
  );
}

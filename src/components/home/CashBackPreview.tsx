"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { findCard } from "@/features/cash-back/cards/catalog";
import { CardArt } from "@/features/cash-back/components/CardArt";
import { brandedName, formatYearlyGain } from "@/features/cash-back/format";
import { useCashBack } from "@/features/cash-back/hooks/useCashBack";
import { ROUTES } from "@/lib/navigation";

export function CashBackPreview() {
  const { analysis } = useCashBack();

  return (
    <section aria-labelledby="cash-back-preview-title" className="flex min-w-0 flex-col gap-2 rounded-panel border border-app bg-card p-3">
      <div className="flex items-center justify-between">
        <h3 id="cash-back-preview-title" className="text-caption font-medium text-secondary">Swipe and Shine</h3>
        <Link href={ROUTES.cashBack} aria-label="Manage cards" className="rounded-item p-1 text-secondary hover:text-accent"><ArrowUpRight aria-hidden className="size-4" /></Link>
      </div>
      {!analysis ? (
        <div aria-busy="true" aria-label="Loading current and recommended cards" className="min-h-32 flex-1 animate-pulse rounded-item bg-skeleton motion-reduce:animate-none" />
      ) : <>
        <div>
          <h4 className="mb-1.5 text-micro font-medium text-secondary">Current cards</h4>
          {analysis.owned.length ? (
            <ul aria-label="Current cards" className="flex gap-2 overflow-x-auto pb-1">
              {analysis.owned.map(card => <li key={card.id} className="min-w-36 flex-1">
                <Link href={ROUTES.cashBack} className="flex h-full items-center gap-2 rounded-item border border-app bg-app weather-tile p-2 hover:border-accent-line">
                  <CardArt card={card} />
                  <span className="text-micro font-medium text-primary">{brandedName(card)}</span>
                </Link>
              </li>)}
            </ul>
          ) : <p className="rounded-item bg-app p-2 text-micro text-secondary">No cards added yet.</p>}
        </div>
        <div>
          <h4 className="mb-1.5 text-micro font-medium text-secondary">Recommended cards</h4>
          {analysis.suggestions.length ? (
            <ul aria-label="Recommended cards" className="flex gap-2 overflow-x-auto pb-1">
              {analysis.suggestions.map(suggestion => {
                const card = findCard(suggestion.cardId);
                if (!card) return null;
                return <li key={card.id} className="min-w-44 flex-1">
                  <Link href={`${ROUTES.cashBack}?suggest=${encodeURIComponent(card.id)}`} className="flex h-full items-center gap-2 rounded-item border border-app bg-app weather-tile p-2 hover:border-accent-line">
                    <CardArt card={card} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-micro font-medium text-primary">{brandedName(card)}</span>
                      <span className="text-micro text-pos">{formatYearlyGain(suggestion.netGainCents)}</span>
                    </span>
                  </Link>
                </li>;
              })}
            </ul>
          ) : <p className="rounded-item bg-app p-2 text-micro text-secondary">No additional cards recommended right now.</p>}
        </div>
      </>}
      <Link href={ROUTES.cashBack} className="jump-link mt-auto self-end">Open Swipe and Shine <ArrowRight aria-hidden className="size-4" /></Link>
    </section>
  );
}

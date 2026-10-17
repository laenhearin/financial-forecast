"use client";

import { useMemo } from "react";
import { Clock, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { findCard } from "../cards/catalog";
import type { WalletAnalysis } from "../engine/analyze";
import { buildLineup, type LineupCapNote } from "../engine/lineup";
import { brandedName, CATEGORY_SHORT_LABELS, formatRate, formatWholeDollars, joinWords, periodNoun } from "../format";
import type { ISODate } from "../types";
import { CardArt } from "./CardArt";
import { chipClass, panelClass } from "./ui";

/** "$1,165 left at 5% this quarter, then Savor for Dining and Entertainment, Quicksilver for Utilities." */
function capNoteText(note: LineupCapNote): string {
  const then = note.then.flatMap(entry => {
    const card = findCard(entry.cardId);
    if (!card) return [];
    return note.then.length === 1
      ? [`${card.name} ${formatRate(entry.rateBps)}`]
      : [`${card.name} for ${joinWords(entry.categories.map(category => CATEGORY_SHORT_LABELS[category]))}`];
  });
  return `Bonus room: ${formatWholeDollars(note.remainingCents)} left at ${formatRate(note.rateBps)} this ${periodNoun(note.period)}, then ${then.length ? then.join(", ") : "the base rate"}.`;
}

/** Which of the user's cards to use for each category they spend in, one short row per card. */
export function LineupPanel({ analysis, today, onOpen, className }: { analysis: WalletAnalysis; today: ISODate; onOpen: (cardId: string) => void; className?: string }) {
  const lineup = useMemo(() => buildLineup(analysis, today), [analysis, today]);
  const unusedNames = lineup.unusedCardIds.flatMap(id => findCard(id)?.name ?? []);

  return (
    <section aria-labelledby="cb-lineup-title" className={cn(panelClass, "px-5 py-4", className)}>
      <h2 id="cb-lineup-title" className="flex items-center gap-1.5 text-caption font-medium text-secondary">
        <ListChecks aria-hidden className="size-4 text-accent" strokeWidth={1.75} /> Your lineup
        <span className="font-normal">· which card to use for what</span>
      </h2>

      {lineup.rows.length === 0 ? (
        <p className="mt-2 text-body text-primary">Add the cards in your wallet to see which one to use.</p>
      ) : (
        <ul className="mt-1.5">
          {lineup.rows.map(row => {
            const card = findCard(row.cardId);
            if (!card) return null;
            return (
              <li key={row.cardId} className="flex items-start gap-3 border-t border-app py-2 first:border-t-0">
                <CardArt card={card} size="sm" />
                <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-3">
                  <button
                    type="button"
                    onClick={() => onOpen(card.id)}
                    aria-label={`${brandedName(card)}, show details`}
                    className="block truncate rounded-sm pt-0.5 text-left text-body font-semibold text-primary underline-offset-4 hover:underline sm:w-40 sm:shrink-0"
                  >
                    {card.name}
                  </button>
                  <div className="mt-1 min-w-0 sm:mt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {row.categories.map(item => (
                        <span key={item.category} className={chipClass}>
                          {item.rotating && <Clock aria-hidden className="size-3" strokeWidth={2} />}
                          {CATEGORY_SHORT_LABELS[item.category]} {formatRate(item.rateBps)}
                          {item.rotating && <span className="sr-only"> (rotating bonus)</span>}
                        </span>
                      ))}
                    </div>
                    {row.capNotes.map(note => (
                      <p key={`${note.period}-${note.remainingCents}`} className="mt-1 text-micro text-secondary">{capNoteText(note)}</p>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {unusedNames.length > 0 && (
        <p className="mt-1.5 text-micro text-secondary">Not needed for your spending: {joinWords(unusedNames)}.</p>
      )}
    </section>
  );
}

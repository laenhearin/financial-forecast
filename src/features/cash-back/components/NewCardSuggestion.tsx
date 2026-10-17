"use client";

import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cardClass, mutedTextClass } from "@/features/big-purchase/components/ui";
import { formatUSD } from "@/lib/money";
import { findCard } from "../cards/library";
import { categoryNoun } from "../format";
import type { CashBackAnalysis } from "../types";

function joinWords(words: string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The one card the user doesn't own that would add the most, after its annual fee. */
export function NewCardSuggestion({ analysis }: { analysis: CashBackAnalysis }) {
  const { suggestion, skippedHighFee } = analysis.suggestion;
  const card = suggestion ? findCard(suggestion.cardId) : undefined;
  return (
    <section aria-labelledby="cb-suggest-heading" className={`${cardClass} flex gap-4 p-6`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--bp-butter)"><Lightbulb aria-hidden className="size-5" /></span>
      <div className="min-w-0 flex-1 space-y-2">
        <h2 id="cb-suggest-heading" className="text-lg font-semibold">One card worth adding</h2>
        {suggestion ? (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-semibold">{suggestion.cardName}</span>
              <Badge className={suggestion.annualFeeCents > 0 ? "bg-(--bp-peach) text-(--bp-ink)" : "bg-(--bp-mint) text-(--bp-ink)"}>
                {suggestion.annualFeeCents > 0 ? `${formatUSD(suggestion.annualFeeCents)} annual fee` : "No annual fee"}
              </Badge>
            </p>
            {card && <p className={`text-sm ${mutedTextClass}`}>{card.blurb}</p>}
            <p>
              On your real spending it would add about <strong>{formatUSD(suggestion.gainAnnualCents)} a year</strong>
              {suggestion.topCategories.length > 0 && <>, mostly on {joinWords(suggestion.topCategories.slice(0, 2).map(item => categoryNoun(item.category)))}</>}.
              {suggestion.annualFeeCents > 0
                ? <> After the {formatUSD(suggestion.annualFeeCents)} fee, that&apos;s about <strong>{formatUSD(suggestion.netAnnualCents)} a year</strong>.</>
                : <> There is no annual fee.</>}
            </p>
          </>
        ) : (
          <p className={mutedTextClass}>No card in the library would add more than it costs on your spending. Your cards already cover it well.</p>
        )}
        {skippedHighFee.length > 0 && (
          <ul className={`space-y-1 text-xs ${mutedTextClass}`}>
            {skippedHighFee.map(item => (
              <li key={item.cardId}>
                Skipped {item.cardName}: it would add about {formatUSD(item.gainAnnualCents)} a year but costs {formatUSD(item.annualFeeCents)}
                {item.netAnnualCents > 0 ? ", which doesn't clearly beat the alternatives." : ", more than it would earn you."}
              </li>
            ))}
          </ul>
        )}
        <p className={`text-xs ${mutedTextClass}`}>Estimated from the last {analysis.windowDays} days and scaled to a year.</p>
      </div>
    </section>
  );
}

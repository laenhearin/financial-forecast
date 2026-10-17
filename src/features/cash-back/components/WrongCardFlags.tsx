"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { useState } from "react";
import { cardClass, linkButtonClass, mutedTextClass } from "@/features/big-purchase/components/ui";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { CATEGORY_LABELS, formatRate } from "../format";
import type { CashBackAnalysis } from "../types";
import { CATEGORY_ICONS } from "./categoryIcons";

const INITIAL_ROWS = 8;

/** Past purchases made on a card that earned less than the best card, biggest misses first. */
export function WrongCardFlags({ analysis }: { analysis: CashBackAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const { flags, rewards } = analysis;
  const flaggedTotal = flags.reduce((sum, flag) => sum + flag.missedCents, 0);
  const rows = expanded ? flags : flags.slice(0, INITIAL_ROWS);

  return (
    <section aria-labelledby="cb-flags-heading" className={`${cardClass} p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cb-flags-heading" className="text-lg font-semibold">Wrong-card purchases</h2>
        {flags.length > 0 && <p className={`text-sm ${mutedTextClass}`}>{flags.length} purchase{flags.length === 1 ? "" : "s"} · {formatUSD(flaggedTotal)} missed</p>}
      </div>
      {flags.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-(--bp-mint) px-4 py-2 text-sm font-semibold">
          <CircleCheck aria-hidden className="size-4" /> No wrong-card purchases in the last {analysis.windowDays} days.
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-(--bp-line)">
            {rows.map(flag => {
              const Icon = CATEGORY_ICONS[flag.category];
              return (
                <li key={flag.purchaseId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--bp-peach)/70"><Icon aria-hidden className="size-4" /></span>
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {flag.merchant} <span className={`font-normal ${mutedTextClass}`}>· {formatUSD(flag.amountCents)} · {formatDate(flag.date, "short")}</span>
                      </p>
                      <p className={`flex flex-wrap items-center gap-1 text-sm ${mutedTextClass}`}>
                        <span>{CATEGORY_LABELS[flag.category]} on {flag.usedCardName} ({formatRate(flag.usedRateBps)})</span>
                        <ArrowRight aria-label="should have been" className="size-3.5" />
                        <span className="text-(--bp-ink)">{flag.betterCardName} ({formatRate(flag.betterRateBps)})</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-(--bp-danger-ink) sm:text-right">{formatUSD(flag.missedCents)} missed</p>
                </li>
              );
            })}
          </ul>
          {flags.length > INITIAL_ROWS && (
            <button type="button" className={`mt-3 ${linkButtonClass}`} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Show fewer" : `Show all ${flags.length}`}
            </button>
          )}
          {rewards.capAdjustmentCents < 0 && (
            <p className={`mt-3 text-xs ${mutedTextClass}`}>
              These add up to {formatUSD(flaggedTotal)}. Following the playbook would also have used up a card&apos;s cap sooner, which takes {formatUSD(-rewards.capAdjustmentCents)} back off, so the net is {formatUSD(Math.max(0, rewards.missedCents))}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

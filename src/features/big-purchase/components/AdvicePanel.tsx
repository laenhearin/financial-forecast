"use client";

import { CircleCheck, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/dates";
import type { BigPurchaseModel } from "../hooks/useBigPurchase";
import { AdviceCard } from "./AdviceCard";
import { cardClass, mutedTextClass } from "./ui";

/** Shown after Help me get there; stays in sync as the deadline moves. */
export function AdvicePanel({ model }: { model: BigPurchaseModel }) {
  const { advice, narration, narrationSource, deadline } = model;
  if (advice.status === "closed") return null;

  if (advice.status === "loading") {
    return (
      <section aria-label="Finding ways to get there sooner" aria-busy="true" className="space-y-3">
        <div className={`${cardClass} h-20 bp-shimmer`} />
        {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-(--bp-radius-card) bp-shimmer" />)}
      </section>
    );
  }

  const { result } = advice;
  const target = deadline ? formatDate(deadline, "long") : null;
  return (
    <section aria-labelledby="bp-advice-heading" className="space-y-4">
      <h3 id="bp-advice-heading" className="sr-only">Ways to get there sooner</h3>
      <div className={`${cardClass} space-y-2 p-5`}>
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-(--bp-primary-ink) uppercase"><Sparkles aria-hidden className="size-4" /> {narrationSource && narrationSource !== "template" ? "AI summary" : "Summary"}</p>
        {narration ? <p aria-live="polite">{narration}</p> : <div className="h-5 w-3/4 rounded bp-shimmer" />}
        {result.combined && result.items.length > 0 && (
          <p className={`text-sm ${mutedTextClass}`}>
            {result.combined.reachesDeadline && target
              ? `Doing ${result.combined.itemIds.length === 1 ? "the first of these" : `these ${result.combined.itemIds.length} things`} gets you there by ${target}.`
              : result.combined.earliestDate
                ? `Even with all of these, the earliest date is ${formatDate(result.combined.earliestDate, "full")}.`
                : "Even with all of these, it stays out of reach within 24 months."}
          </p>
        )}
      </div>
      {result.onTrack ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-(--bp-mint) px-4 py-2 text-sm font-semibold"><CircleCheck aria-hidden className="size-4" /> You&apos;re on track for {target}.</p>
      ) : result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((item, index) => <AdviceCard key={item.id} item={item} index={index} />)}
        </ol>
      ) : (
        <p className={`${cardClass} p-5 text-sm ${mutedTextClass}`}>No single change moves your date. Try a later deadline or a lower cost.</p>
      )}
    </section>
  );
}

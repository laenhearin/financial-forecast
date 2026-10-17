"use client";

import { RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bounce } from "@/features/big-purchase/components/motion";
import { cardClass, mutedTextClass, secondaryButtonClass } from "@/features/big-purchase/components/ui";
import type { CashBackModel } from "../hooks/useCashBack";

/** Live templated summary, plus AI advice on request. The AI only explains numbers the engine computed. */
export function AdvicePanel({ model }: { model: CashBackModel }) {
  const { summary, aiAdvice, aiAdviceStale, actions } = model;
  if (!summary) return null;
  const loading = aiAdvice.status === "loading";
  const response = aiAdvice.status === "done" ? aiAdvice.response : null;

  return (
    <section aria-labelledby="cb-advice-heading" className={`${cardClass} space-y-3 p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cb-advice-heading" className="flex items-center gap-2 text-xs font-semibold tracking-wide text-(--bp-primary-ink) uppercase">
          <Sparkles aria-hidden className="size-4" /> Summary
        </h2>
        <Bounce disabled={loading}>
          <Button variant="outline" className={secondaryButtonClass} disabled={loading} onClick={() => void actions.requestAiAdvice()}>
            {response ? <><RefreshCw aria-hidden /> Refresh AI advice</> : <><Sparkles aria-hidden /> Ask AI for advice</>}
          </Button>
        </Bounce>
      </div>
      <p aria-live="polite">{summary}</p>

      {loading && <div aria-busy="true" aria-label="Asking AI" className="h-16 rounded-(--bp-radius-control) bp-shimmer" />}
      {response && (
        <div className={`space-y-2 rounded-(--bp-radius-control) bg-(--bp-bg) p-4 ${aiAdviceStale ? "opacity-60" : ""}`}>
          {response.status === "ai" && (
            <>
              <Badge className="bg-(--bp-lilac) text-(--bp-ink)"><Sparkles aria-hidden /> AI advice</Badge>
              <p aria-live="polite" className="whitespace-pre-line">{response.text}</p>
              <p className={`text-xs ${mutedTextClass}`}>Written by Claude from the numbers on this page. Check the playbook before acting on it.</p>
            </>
          )}
          {response.status === "template" && <p className={`text-sm ${mutedTextClass}`}>{response.message} The summary above is the templated version.</p>}
          {response.status === "error" && (
            <p role="alert" className="flex items-start gap-2 text-sm text-(--bp-danger-ink)">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> AI advice failed: {response.message} The summary above still reflects your numbers.
            </p>
          )}
          {aiAdviceStale && <p className={`text-xs ${mutedTextClass}`}>Your inputs changed since this advice. Refresh it to match.</p>}
        </div>
      )}
    </section>
  );
}

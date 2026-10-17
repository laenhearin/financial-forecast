"use client";

import { Badge } from "@/components/ui/badge";
import { cardClass, mutedTextClass } from "@/features/big-purchase/components/ui";
import { formatUSD } from "@/lib/money";
import { findCard } from "../cards/library";
import { CATEGORY_LABELS, formatCardRate, formatRate, periodNoun } from "../format";
import type { CashBackModel } from "../hooks/useCashBack";
import type { PlaybookEntry } from "../types";
import { CATEGORY_ICONS } from "./categoryIcons";

/** Best card for each category, with cap hand-offs. */
export function Playbook({ model }: { model: CashBackModel }) {
  const { analysis } = model;
  if (!analysis) return null;
  return (
    <section aria-labelledby="cb-playbook-heading" className={`${cardClass} p-6`}>
      <h2 id="cb-playbook-heading" className="text-lg font-semibold">Category playbook</h2>
      <p className={`mt-1 text-sm ${mutedTextClass}`}>Use these cards from now on. Spending is from the last {analysis.windowDays} days.</p>
      {analysis.playbook.length === 0 ? (
        <p className={`mt-4 text-sm ${mutedTextClass}`}>Select at least one card to see your playbook.</p>
      ) : (
        <ul className="mt-4 divide-y divide-(--bp-line)">
          {analysis.playbook.map(entry => <PlaybookRow key={entry.category} entry={entry} />)}
        </ul>
      )}
      <CategorizationNote model={model} />
    </section>
  );
}

function PlaybookRow({ entry }: { entry: PlaybookEntry }) {
  const Icon = CATEGORY_ICONS[entry.category];
  const card = findCard(entry.primary.cardId);
  const idle = entry.spendCents === 0;
  return (
    <li className={`grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center ${idle ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--bp-lilac)/60"><Icon aria-hidden className="size-4" /></span>
        <div>
          <p className="font-semibold">{CATEGORY_LABELS[entry.category]}</p>
          <p className={`text-xs ${mutedTextClass}`}>{idle ? "No spending in this window" : `${formatUSD(entry.spendCents)} spent`}</p>
        </div>
      </div>
      <div className="sm:text-right">
        <p className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="font-semibold">{entry.primary.cardName}</span>
          <Badge className="bg-(--bp-mint) text-(--bp-ink)">{card ? formatCardRate(entry.primary.rateBps, card) : formatRate(entry.primary.rateBps)}</Badge>
        </p>
        {entry.cap && (
          <p className={`mt-0.5 text-xs ${mutedTextClass}`}>
            Up to {formatUSD(entry.cap.amountCents)} a {periodNoun(entry.cap.period)}, {formatUSD(entry.cap.remainingCents)} left this {periodNoun(entry.cap.period)}.{" "}
            {entry.fallback
              ? <>Then {entry.fallback.cardName} ({formatRate(entry.fallback.rateBps)}).</>
              : <>Then {formatRate(entry.cap.afterCapRateBps)}.</>}
          </p>
        )}
      </div>
    </li>
  );
}

function CategorizationNote({ model }: { model: CashBackModel }) {
  const { unmatched, aiCategorize } = model;
  if (unmatched.length === 0) return null;
  const count = `${unmatched.length} merchant${unmatched.length === 1 ? "" : "s"}`;
  let text: string;
  let tone = mutedTextClass;
  switch (aiCategorize.status) {
    case "idle":
    case "loading":
      text = `${count} weren't in the keyword list. Asking AI to classify them…`;
      break;
    case "done": {
      const categoryOf = new Map(model.purchases.map(purchase => [purchase.merchant, purchase.category]));
      text = `${count} weren't in the keyword list, so AI classified them: ${unmatched.map(name => `${name} (${CATEGORY_LABELS[categoryOf.get(name) ?? "other"]})`).join(", ")}.`;
      break;
    }
    case "unavailable":
      text = `${count} weren't in the keyword list and count as Everything else. ${aiCategorize.message}`;
      break;
    case "error":
      text = `${count} weren't in the keyword list and count as Everything else. AI classification failed: ${aiCategorize.message}`;
      tone = "text-(--bp-danger-ink)";
      break;
  }
  return <p role={aiCategorize.status === "error" ? "alert" : undefined} className={`mt-4 text-xs ${tone}`}>{text}</p>;
}

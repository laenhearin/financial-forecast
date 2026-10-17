"use client";

import { Check, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cardClass, linkButtonClass, mutedTextClass } from "@/features/big-purchase/components/ui";
import { formatUSD } from "@/lib/money";
import { CARD_LIBRARY } from "../cards/library";
import type { CashBackModel } from "../hooks/useCashBack";

/** Pick the cards you own from the library. Every change reruns the page. */
export function CardPicker({ model }: { model: CashBackModel }) {
  const { selectedCardIds, selectionIsDefault, actions } = model;
  const usedIds = new Set(model.data?.purchases.map(purchase => purchase.cardId) ?? []);
  return (
    <section aria-labelledby="cb-cards-heading" className={`${cardClass} space-y-4 p-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="cb-cards-heading" className="flex items-center gap-2 text-lg font-semibold"><CreditCard aria-hidden className="size-5" /> Your cards</h2>
          <p className={`mt-1 text-sm ${mutedTextClass}`}>Check the cards you own.</p>
        </div>
        {!selectionIsDefault && <button type="button" className={linkButtonClass} onClick={actions.resetCards}>Reset</button>}
      </div>
      <ul className="space-y-2">
        {CARD_LIBRARY.map(card => {
          const checked = selectedCardIds.includes(card.id);
          const inputId = `cb-card-${card.id}`;
          return (
            <li key={card.id}>
              <label
                htmlFor={inputId}
                className={`flex cursor-pointer gap-3 rounded-(--bp-radius-control) border p-3 transition-colors ${checked ? "border-(--bp-primary) bg-(--bp-lilac)/25" : "border-(--bp-line) hover:bg-(--bp-bg)"}`}
              >
                <input id={inputId} type="checkbox" className="peer sr-only" checked={checked} onChange={() => actions.toggleCard(card.id)} />
                <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border peer-focus-visible:outline-2 peer-focus-visible:outline-(--bp-primary-ink) ${checked ? "border-(--bp-primary-ink) bg-(--bp-primary-ink) text-white" : "border-(--bp-line) bg-(--bp-surface)"}`}>
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{card.name}</span>
                    {card.rewardType === "points" && <Badge className="bg-(--bp-sky) text-(--bp-ink)">Points</Badge>}
                  </span>
                  <span className={`block text-sm ${mutedTextClass}`}>{card.blurb}</span>
                  <span className={`block text-xs ${mutedTextClass}`}>
                    {card.annualFeeCents > 0 ? `${formatUSD(card.annualFeeCents)} annual fee` : "No annual fee"}
                    {usedIds.has(card.id) && " · used in your purchases"}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className={`text-xs ${mutedTextClass}`}>
        Sample cards with illustrative rates, not current issuer offers. Points count as 1 cent each. Past purchases are always scored with the card you actually used.
      </p>
    </section>
  );
}

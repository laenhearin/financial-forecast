"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/features/big-purchase/components/MoneyInput";
import { cardClass, inputClass, mutedTextClass, primaryButtonClass } from "@/features/big-purchase/components/ui";
import { formatUSD } from "@/lib/money";
import { MAX_MERCHANT_LENGTH } from "../config";
import { CATEGORY_LABELS, formatRate, periodNoun } from "../format";
import type { CashBackModel } from "../hooks/useCashBack";
import { CATEGORIES, type Category } from "../types";

/** "Which card should I use?" for a merchant or category plus an amount. */
export function PurchaseLookup({ model }: { model: CashBackModel }) {
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<Category | "auto">("auto");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { lookupQuery, lookupResult, lookupPending, actions } = model;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!amountCents || amountCents <= 0) return setError("Enter an amount above $0.");
    if (category === "auto" && !merchant.trim()) return setError("Enter a merchant or pick a category.");
    setError(null);
    void actions.runLookup({ merchant, category, amountCents });
  }

  return (
    <section aria-labelledby="cb-lookup-heading" className={`${cardClass} space-y-4 p-6`}>
      <div>
        <h2 id="cb-lookup-heading" className="flex items-center gap-2 text-lg font-semibold"><Search aria-hidden className="size-5" /> Which card should I use?</h2>
        <p className={`mt-1 text-sm ${mutedTextClass}`}>Enter a merchant or a category, plus the amount.</p>
      </div>
      <form className="space-y-3" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="cb-lookup-merchant">Merchant</Label>
          <Input id="cb-lookup-merchant" value={merchant} maxLength={MAX_MERCHANT_LENGTH} placeholder="Shell" autoComplete="off" className={inputClass} onChange={event => setMerchant(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-lookup-category">Category</Label>
          <select
            id="cb-lookup-category"
            value={category}
            onChange={event => setCategory(event.target.value as Category | "auto")}
            className={`${inputClass} w-full border`}
          >
            <option value="auto">Detect from merchant</option>
            {CATEGORIES.map(option => <option key={option} value={option}>{CATEGORY_LABELS[option]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-lookup-amount">Amount</Label>
          <MoneyInput id="cb-lookup-amount" value={amountCents} placeholder="45" onChange={setAmountCents} describedBy={error ? "cb-lookup-error" : undefined} invalid={Boolean(error)} />
        </div>
        {error && <p id="cb-lookup-error" className="text-sm text-(--bp-danger-ink)">{error}</p>}
        <Button type="submit" className={`${primaryButtonClass} w-full`} disabled={lookupPending}>
          {lookupPending ? "Checking…" : "Find the best card"}
        </Button>
      </form>

      {lookupQuery && (
        <div aria-live="polite" className="space-y-1.5 rounded-(--bp-radius-control) bg-(--bp-bg) p-4">
          <p className={`text-xs ${mutedTextClass}`}>
            {lookupQuery.merchant ? `${lookupQuery.merchant} · ` : ""}{formatUSD(lookupQuery.amountCents)} · {CATEGORY_LABELS[lookupQuery.category]}
            {lookupQuery.categorySource === "keyword" && " (matched by keyword)"}
            {lookupQuery.categorySource === "ai" && " (classified by AI)"}
          </p>
          {lookupQuery.categorySource === "fallback" && (
            <p className="text-xs text-(--bp-warn-ink)">We couldn&apos;t tell this merchant&apos;s category, so it counts as Everything else. Pick a category for a better answer.</p>
          )}
          {lookupResult ? (
            <>
              <p className="text-lg font-semibold">Use {lookupResult.best.cardName}</p>
              <p>
                Earns {formatUSD(lookupResult.best.rewardCents)}
                {lookupResult.best.capped ? ` (part of it above the cap)` : ` (${formatRate(lookupResult.best.rateBps)})`}.
              </p>
              {lookupResult.capRemainingAfterCents !== null && lookupResult.best.capPeriod && (
                <p className={`text-sm ${mutedTextClass}`}>
                  {formatUSD(lookupResult.capRemainingAfterCents)} of this card&apos;s cap left this {periodNoun(lookupResult.best.capPeriod)} after this purchase.
                </p>
              )}
              {lookupResult.best.capRemainingCents === null && <p className={`text-sm ${mutedTextClass}`}>No spending cap on this rate.</p>}
              {lookupResult.runnerUp && (
                <p className={`text-sm ${mutedTextClass}`}>Next best: {lookupResult.runnerUp.cardName}, {formatUSD(lookupResult.runnerUp.rewardCents)}.</p>
              )}
            </>
          ) : (
            <p className={`text-sm ${mutedTextClass}`}>Select at least one card to get an answer.</p>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { DebtSummary } from "@/components/home/DebtSummary";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { Database } from "lucide-react";
import { useActiveCustomerId } from "@/components/layout/ActiveCustomer";
import { forecastEstimateNote, nessieSourceNote } from "@/lib/data-source";
import { addDays, formatDate, isISODate } from "@/lib/dates";
import { formatUSD, parseDollarsToCents } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import type { Scenario } from "@/features/big-purchase/types";
import { PURCHASE_NAME_MAX_LENGTH } from "../config";
import { buildAdvisorFacts } from "@/lib/ai/facts/advisor";
import { advisorTemplate } from "@/lib/ai/fallbacks";
import type { PurchaseInput } from "@/lib/ai/types";
import { ALL_ACCOUNTS } from "../types";
import { buildCalendarModel, lowestBalance } from "../engine/model";
import { scenarioEntries } from "../engine/entries";
import { checkPurchase, purchaseRecommendation } from "../engine/purchaseCheck";
import { purchaseStore } from "../state/purchaseStore";
import { useAdvisorExplanation } from "../state/useAdvisorExplanation";
import { useCriticalBalance } from "../state/useCriticalBalance";
import { BALANCE_LABELS, balanceLevel, defaultCriticalBalanceCents, type BalanceLevel } from "../engine/balanceThresholds";
import { AdvisorExplanationPanel } from "./AdvisorExplanationPanel";
import { inputClass, labelClass, panelClass, panelTitleClass, primaryButtonClass, subtitleClass } from "./ui";

const RECOMMENDATION_TONES: Record<BalanceLevel, string> = {
  0: "bg-pos-soft", 1: "bg-pos-soft", 2: "bg-accent-soft", 3: "bg-rain-soft", 4: "bg-neg-soft", 5: "bg-neg-soft",
};

export function PurchaseAdvisorApp({ scenario }: { scenario: Scenario }) {
  const customerId = useActiveCustomerId();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(scenario.asOfDate);
  const [accountId, setAccountId] = useState(scenario.accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const purchases = useSyncExternalStore(purchaseStore.subscribe, () => purchaseStore.getSnapshot(customerId), purchaseStore.getServerSnapshot);
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents(scenario));
  const entries = useMemo(() => scenarioEntries(scenario), [scenario]);
  const baseline = useMemo(() => buildCalendarModel(scenario, purchases, ALL_ACCOUNTS, entries), [scenario, purchases, entries]);
  const amountCents = parseDollarsToCents(amount);
  const isValid = name.trim().length > 0 && amountCents !== null && amountCents > 0
    && isISODate(date) && date >= scenario.asOfDate && date <= baseline.forecastEnd
    && scenario.accounts.some((account) => account.id === accountId);
  const hypothetical: PurchaseInput | null = isValid ? { label: name.trim(), amountCents: amountCents!, date, accountId } : null;
  const check = hypothetical && !added ? checkPurchase(scenario, purchases, hypothetical, criticalBalanceCents, entries, baseline) : null;
  const preview = check?.preview ?? null;
  const baselineLow = lowestBalance(baseline);
  const baselineLowAfterDate = check?.lowestWithout ?? baselineLow;
  const previewLowAfterDate = check?.lowestWith ?? null;
  const recommendation = check ? { ...purchaseRecommendation(check), tone: RECOMMENDATION_TONES[check.level] } : null;
  const explanation = useAdvisorExplanation(check ? hypothetical : null, criticalBalanceCents, purchases,
    () => hypothetical ? advisorTemplate(buildAdvisorFacts(scenario, purchases, hypothetical, criticalBalanceCents, entries)) : null);

  function addToCalendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdded(false);
    if (!name.trim() || amountCents === null || amountCents <= 0 || !isISODate(date)
      || date < scenario.asOfDate || date > baseline.forecastEnd
      || !scenario.accounts.some((account) => account.id === accountId)) {
      setError(`Enter a name, a valid amount, and a date from ${formatDate(scenario.asOfDate, "short")} to ${formatDate(baseline.forecastEnd, "short")}.`);
      return;
    }
    purchaseStore.add(customerId, { label: name.trim(), amountCents, date, accountId });
    setError(null);
    setAdded(true);
  }

  const impactStart = isISODate(date) && date >= scenario.asOfDate ? date : scenario.asOfDate;
  const weekEnds = [6, 13, 20, 27].map((offset) => addDays(impactStart, offset)).filter((weekEnd) => weekEnd <= baseline.forecastEnd);

  return (
    <div className="mx-auto w-full max-w-300 px-5 py-12 md:px-10">
      <header className="mb-7 text-center">
        <h1 className="text-display font-medium text-primary">Purchase Advisor</h1>
        <p className="mt-1.5 text-caption text-secondary">Try a purchase against your cash forecast before deciding whether to add it to your calendar.</p>
        <p className="mt-2 flex items-start justify-center gap-1.5 text-caption text-secondary"><Database aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />{nessieSourceNote(scenario.customerName, scenario.asOfDate)}</p>
      </header>
      <DebtSummary scenario={scenario} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <section aria-labelledby="hypothetical-title" className={panelClass}>
          <h2 id="hypothetical-title" className={panelTitleClass}>Try a hypothetical purchase</h2>
          <p className={subtitleClass}>This preview changes no calendar data.</p>
          <form onSubmit={addToCalendar} noValidate className="mt-4.5 flex flex-col gap-3">
            <div>
              <label htmlFor="advisor-name" className={labelClass}>What are you thinking of buying?</label>
              <input id="advisor-name" value={name} onChange={(event) => { setName(event.target.value); setAdded(false); }} maxLength={PURCHASE_NAME_MAX_LENGTH} placeholder="e.g. New laptop" className={inputClass} />
            </div>
            <div>
              <label htmlFor="advisor-amount" className={labelClass}>Purchase amount ($)</label>
              <input id="advisor-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setAdded(false); }} placeholder="899.00" className={inputClass} />
            </div>
            <div>
              <label htmlFor="advisor-date" className={labelClass}>When would you buy it?</label>
              <input id="advisor-date" type="date" min={scenario.asOfDate} max={baseline.forecastEnd} value={date} onChange={(event) => { setDate(event.target.value); setAdded(false); }} className={inputClass} />
            </div>
            <div>
              <label htmlFor="advisor-account" className={labelClass}>Pay from</label>
              <select id="advisor-account" value={accountId} onChange={(event) => { setAccountId(event.target.value); setAdded(false); }} className={inputClass}>
                {scenario.accounts.map((account) => <option key={account.id} value={account.id}>{account.nickname}</option>)}
              </select>
            </div>
            {error && <p role="alert" className="text-caption text-neg">{error}</p>}
            <button type="submit" disabled={added} className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>Add this purchase to my calendar</button>
            {added && <p role="status" className="rounded-item bg-pos-soft px-3 py-3 text-caption text-primary">Purchase added to your calendar. <Link href={`${ROUTES.calendar}?date=${date}`} className="font-semibold underline underline-offset-2">View it on your calendar</Link></p>}
          </form>
        </section>

        <section aria-labelledby="impact-title" className={panelClass}>
          <h2 id="impact-title" className={panelTitleClass}>Forecast impact</h2>
          <p className={subtitleClass}>Projected combined balance at the end of each coming week</p>
          {!preview ? (
            <p className="mt-5 rounded-item bg-secondary px-3.5 py-3 text-caption text-secondary">Enter the purchase details to see how it changes your forecast.</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-app pb-2 text-micro font-semibold text-secondary">
                <span>Week ending</span><span>Before</span><span>With purchase</span>
              </div>
              <ul>
                {weekEnds.map((weekEnd) => {
                  const before = baseline.balances.get(weekEnd)?.totalCents ?? baselineLow.cents;
                  const after = preview.balances.get(weekEnd)?.totalCents ?? before;
                  return <li key={weekEnd} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b border-app py-3 text-caption last:border-b-0">
                    <span className="text-secondary">{formatDate(weekEnd, "short")}</span><span className="text-primary">{formatUSD(before)}</span><span className={after < before ? "font-semibold text-neg" : "text-primary"}>{formatUSD(after)}</span>
                  </li>;
                })}
              </ul>
              <div className="mt-3 grid gap-3 rounded-item bg-secondary p-3.5 sm:grid-cols-2">
                <div><p className="text-micro text-secondary">Lowest balance without it</p><p className="mt-1 text-body font-semibold text-primary">{formatUSD(baselineLowAfterDate.cents)} <span className="text-caption font-normal text-secondary">· {BALANCE_LABELS[balanceLevel(baselineLowAfterDate.cents, criticalBalanceCents)]} · {formatDate(baselineLowAfterDate.date, "short")}</span></p></div>
                <div><p className="text-micro text-secondary">Lowest balance with it</p><p className={`mt-1 text-body font-semibold ${balanceLevel(previewLowAfterDate!.cents, criticalBalanceCents) >= 4 ? "text-neg" : "text-primary"}`}>{formatUSD(previewLowAfterDate!.cents)} <span className="text-caption font-normal text-secondary">· {BALANCE_LABELS[balanceLevel(previewLowAfterDate!.cents, criticalBalanceCents)]} · {formatDate(previewLowAfterDate!.date, "short")}</span></p></div>
              </div>
              {recommendation && <div className={`mt-3 rounded-item px-3.5 py-3 ${recommendation.tone}`}>
                <p className="text-caption font-semibold text-primary">{recommendation.title}</p>
                <p className="mt-1 text-caption text-primary">{recommendation.detail}</p>
              </div>}
              <AdvisorExplanationPanel state={explanation} />
              <p className="mt-3 text-micro text-secondary">Forecast includes Nessie bills plus income and everyday spending. {forecastEstimateNote(scenario)} This is an estimate, not a guarantee.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

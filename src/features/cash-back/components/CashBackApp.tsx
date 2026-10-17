"use client";

import { Database, Lightbulb, TriangleAlert } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { FadeRise } from "@/features/big-purchase/components/motion";
import { cardClass, mutedTextClass } from "@/features/big-purchase/components/ui";
import { formatDate } from "@/lib/dates";
import { useCashBack } from "../hooks/useCashBack";
import { AdvicePanel } from "./AdvicePanel";
import { CardPicker } from "./CardPicker";
import { NewCardSuggestion } from "./NewCardSuggestion";
import { Playbook } from "./Playbook";
import { PurchaseLookup } from "./PurchaseLookup";
import { SavingsHero } from "./SavingsHero";
import { WindowSelector } from "./WindowSelector";
import { WrongCardFlags } from "./WrongCardFlags";

export function CashBackApp() {
  const model = useCashBack();
  const { dataState, data, analysis, actions } = model;

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Swipe and Shine</h1>
          {data && model.isFixture && (
            <p className={`mt-1 flex items-center gap-1.5 text-sm ${mutedTextClass}`}>
              <Database aria-hidden className="size-4" />
              {model.sourceLabel}: {data.customerName}&apos;s card purchases through {formatDate(data.asOfDate, "full")}. Not live bank data.
            </p>
          )}
        </div>
        {data && model.hydrated && (
          <div className="flex flex-wrap items-center gap-3">
            <WindowSelector value={model.windowDays} onChange={actions.setWindow} />
            <Toggle
              variant="outline"
              pressed={model.showSuggestion}
              onPressedChange={actions.setShowSuggestion}
              aria-label="Show new-card suggestion"
              className="h-11 rounded-(--bp-radius-control) border-(--bp-line) bg-(--bp-surface) px-4 text-sm font-semibold text-(--bp-muted) aria-pressed:bg-(--bp-butter) aria-pressed:text-(--bp-ink)"
            >
              <Lightbulb aria-hidden /> New-card tip {model.showSuggestion ? "on" : "off"}
            </Toggle>
          </div>
        )}
      </header>

      {dataState.status === "error" ? (
        <section role="alert" className={`${cardClass} flex gap-4 p-6`}>
          <TriangleAlert aria-hidden className="size-6 shrink-0 text-(--bp-danger-ink)" />
          <div>
            <h2 className="font-semibold">We couldn&apos;t load your purchases</h2>
            <p className={`mt-1 ${mutedTextClass}`}>{dataState.message}</p>
            {dataState.details.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{dataState.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
          </div>
        </section>
      ) : !analysis || !model.hydrated ? (
        <div className={`${cardClass} h-64 bp-shimmer`} aria-busy="true" aria-label="Loading" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* On phones the results come first; on desktop the inputs sit in the left column. */}
          <div className="order-2 space-y-6 lg:order-1">
            <FadeRise index={0}><CardPicker model={model} /></FadeRise>
            <FadeRise index={1}><PurchaseLookup model={model} /></FadeRise>
          </div>
          <div className="order-1 space-y-6 lg:order-2">
            <FadeRise index={1}><SavingsHero analysis={analysis} /></FadeRise>
            <FadeRise index={2}><AdvicePanel model={model} /></FadeRise>
            <FadeRise index={3}><Playbook model={model} /></FadeRise>
            <FadeRise index={4}><WrongCardFlags analysis={analysis} /></FadeRise>
            {model.showSuggestion && <FadeRise index={5}><NewCardSuggestion analysis={analysis} /></FadeRise>}
          </div>
        </div>
      )}
    </div>
  );
}

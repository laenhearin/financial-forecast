"use client";

import { useMemo, useRef, useState } from "react";
import { Database } from "lucide-react";
import { parseDollarsToCents } from "@/lib/money";
import type { Scenario } from "../../big-purchase/types";
import { scenarioEntries } from "../engine/entries";
import { monthStartOf } from "../engine/grid";
import { buildCalendarModel } from "../engine/model";
import { stormAdvice } from "../engine/stormAdvice";
import { ALL_ACCOUNTS, type AccountView, type ISODate, type UserPurchase } from "../types";
import { AddPurchasePanel } from "./AddPurchasePanel";
import { MoneyCalendar } from "./MoneyCalendar";
import { SelectedDayPanel } from "./SelectedDayPanel";
import { StatsRow } from "./StatsRow";
import { StormSolverPanel, type StormState } from "./StormSolverPanel";
import { WeeklySpendingChart } from "./WeeklySpendingChart";

const STORM_READY: StormState = { tone: "neutral", message: "Ready to review your bills, projected balance, and upcoming income.", items: [] };

interface CalendarAppProps {
  scenario: Scenario;
  sourceLabel: string;
  isFixture: boolean;
}

/** Money calendar, weekly spending and Storm Solver for one scenario. Page state lives in memory. */
export function CalendarApp({ scenario, sourceLabel, isFixture }: CalendarAppProps) {
  const asOf = scenario.asOfDate;
  const [view, setView] = useState<AccountView>(ALL_ACCOUNTS);
  const [selected, setSelected] = useState<ISODate>(asOf);
  const [month, setMonth] = useState<ISODate>(monthStartOf(asOf));
  const [purchaseDate, setPurchaseDate] = useState<string>(asOf);
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [storm, setStorm] = useState<StormState>(STORM_READY);
  const nextPurchaseId = useRef(1);

  const baseEntries = useMemo(() => scenarioEntries(scenario), [scenario]);
  const model = useMemo(() => buildCalendarModel(scenario, purchases, view, baseEntries), [scenario, purchases, view, baseEntries]);
  const accountNames = useMemo(() => Object.fromEntries(scenario.accounts.map((a) => [a.id, a.nickname])), [scenario]);
  const viewName = view === ALL_ACCOUNTS ? null : (accountNames[view] ?? null);

  function selectDay(date: ISODate) {
    setSelected(date);
    setPurchaseDate(date);
  }

  function goToday() {
    selectDay(asOf);
    setMonth(monthStartOf(asOf));
  }

  function changeView(next: AccountView) {
    setView(next);
    setStorm({ tone: "neutral", message: "Account view changed. Generate advice again to review this account view.", items: [] });
  }

  function addPurchase(purchase: Omit<UserPurchase, "id">) {
    setPurchases((list) => [...list, { ...purchase, id: `purchase-${nextPurchaseId.current++}` }]);
    selectDay(purchase.date);
    setMonth(monthStartOf(purchase.date));
  }

  function analyze(bufferDollars: string) {
    const bufferCents = parseDollarsToCents(bufferDollars);
    if (bufferCents === null) {
      setStorm({ tone: "warning", message: "Enter a valid cash buffer of $0 or more.", items: [] });
      return;
    }
    setStorm({
      tone: "success",
      message: "Advice generated from the current demo forecast. Nothing has been rescheduled, paid, or changed.",
      items: stormAdvice(model, accountNames, bufferCents),
    });
  }

  return (
    <div className="mx-auto w-full max-w-300 px-5 py-12 md:px-10">
      <header className="mb-7">
        <h1 className="text-display font-medium text-primary">Calendar</h1>
        {isFixture && (
          <p className="mt-1.5 flex items-start gap-1.5 text-caption text-secondary">
            <Database aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {sourceLabel}: {scenario.customerName}, {scenario.label.toLowerCase()} scenario. Not live bank data; includes estimated everyday spending. Purchases and cards you add reset when you reload.
          </p>
        )}
      </header>

      <StatsRow model={model} viewName={viewName} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <MoneyCalendar model={model} month={month} selected={selected} viewName={viewName} onMonthChange={setMonth} onSelect={selectDay} onToday={goToday} />
          <WeeklySpendingChart model={model} selected={selected} />
          <StormSolverPanel storm={storm} onAnalyze={analyze} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <SelectedDayPanel
            model={model}
            date={selected}
            accountNames={accountNames}
            onRemovePurchase={(id) => setPurchases((list) => list.filter((p) => p.id !== id))}
          />
          <AddPurchasePanel accounts={scenario.accounts} date={purchaseDate} onDateChange={setPurchaseDate} view={view} onViewChange={changeView} onAdd={addPurchase} />
        </div>
      </div>
    </div>
  );
}

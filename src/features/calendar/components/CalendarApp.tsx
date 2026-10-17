"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Database } from "lucide-react";
import { useActiveCustomerId } from "@/components/layout/ActiveCustomer";
import { forecastEstimateNote, nessieSourceNote } from "@/lib/data-source";
import { isISODate } from "@/lib/dates";
import { DebtSummary } from "@/components/home/DebtSummary";
import type { Scenario } from "../../big-purchase/types";
import { forecastEndDate, scenarioEntries } from "../engine/entries";
import { monthStartOf } from "../engine/grid";
import { buildCalendarModel } from "../engine/model";
import { defaultCriticalBalanceCents } from "../engine/balanceThresholds";
import { ALL_ACCOUNTS, type AccountView, type ISODate, type UserPurchase } from "../types";
import { purchaseStore } from "../state/purchaseStore";
import { useCriticalBalance } from "../state/useCriticalBalance";
import { AddPurchasePanel } from "./AddPurchasePanel";
import { MoneyCalendar } from "./MoneyCalendar";
import { SelectedDayPanel } from "./SelectedDayPanel";
import { StatsRow } from "./StatsRow";
import { WeeklySpendingChart } from "./WeeklySpendingChart";

interface CalendarAppProps {
  scenario: Scenario;
  initialDate?: string;
}

/** Money calendar and weekly spending for one scenario; view state is local, purchases are saved per Nessie customer. */
export function CalendarApp({ scenario, initialDate }: CalendarAppProps) {
  const customerId = useActiveCustomerId();
  const asOf = scenario.asOfDate;
  const startDate = initialDate && isISODate(initialDate) && initialDate >= asOf && initialDate <= forecastEndDate(asOf) ? initialDate : asOf;
  const [view, setView] = useState<AccountView>(ALL_ACCOUNTS);
  const [selected, setSelected] = useState<ISODate>(startDate);
  const [month, setMonth] = useState<ISODate>(monthStartOf(startDate));
  const [purchaseDate, setPurchaseDate] = useState<string>(startDate);
  const purchases = useSyncExternalStore(purchaseStore.subscribe, () => purchaseStore.getSnapshot(customerId), purchaseStore.getServerSnapshot);
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents(scenario));

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
  }

  function addPurchase(purchase: Omit<UserPurchase, "id">) {
    purchaseStore.add(customerId, purchase);
    selectDay(purchase.date);
    setMonth(monthStartOf(purchase.date));
  }

  return (
    <div className="mx-auto w-full max-w-300 px-5 py-12 md:px-10">
      <header className="mb-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-display font-medium text-primary">Weather Calendar</h1>
          {purchases.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Clear all ${purchases.length} saved test purchase${purchases.length === 1 ? "" : "s"} for this customer?`)) {
                  purchaseStore.clear(customerId);
                }
              }}
              className="rounded-item border border-app bg-card px-3 py-2 text-caption text-secondary hover:bg-nav-hover"
            >
              Clear test purchases
            </button>
          )}
        </div>
        <p className="mt-1.5 flex items-start gap-1.5 text-caption text-secondary">
          <Database aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {nessieSourceNote(scenario.customerName, scenario.asOfDate)} {forecastEstimateNote(scenario)} Purchases you add are saved in this browser for this customer.
        </p>
      </header>

      <StatsRow model={model} viewName={viewName} criticalBalanceCents={criticalBalanceCents} />
      <DebtSummary scenario={scenario} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <MoneyCalendar model={model} month={month} selected={selected} viewName={viewName} criticalBalanceCents={criticalBalanceCents} onMonthChange={setMonth} onSelect={selectDay} onToday={goToday} />
          <WeeklySpendingChart model={model} selected={selected} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <SelectedDayPanel
            model={model}
            date={selected}
            accountNames={accountNames}
            criticalBalanceCents={criticalBalanceCents}
            onRemovePurchase={(id, date, deleteFuturePayments) => purchaseStore.removeOccurrence(customerId, id, date, deleteFuturePayments)}
          />
          <AddPurchasePanel accounts={scenario.accounts} date={purchaseDate} onDateChange={setPurchaseDate} view={view} onViewChange={changeView} onAdd={addPurchase} />
        </div>
      </div>
    </div>
  );
}

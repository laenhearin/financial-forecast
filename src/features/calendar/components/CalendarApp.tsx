"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CalendarDays, Database, List } from "lucide-react";
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
import { SpendingChart } from "./SpendingChart";
import { CalendarListView } from "./CalendarListView";

interface RecordedPayment {
  id: string;
  accountId: string;
  date: ISODate;
  label: string;
  amountCents: number;
}

interface CalendarAppProps {
  scenario: Scenario;
  pastPayments: RecordedPayment[];
  initialDate?: string;
}

/** Money calendar and weekly spending for one scenario; view state is local, purchases are saved per Nessie customer. */
export function CalendarApp({ scenario, pastPayments, initialDate }: CalendarAppProps) {
  const customerId = useActiveCustomerId();
  const asOf = scenario.asOfDate;
  const startDate = initialDate && isISODate(initialDate) && initialDate >= asOf && initialDate <= forecastEndDate(asOf) ? initialDate : asOf;
  const [view, setView] = useState<AccountView>(ALL_ACCOUNTS);
  const [selected, setSelected] = useState<ISODate>(startDate);
  const [month, setMonth] = useState<ISODate>(monthStartOf(startDate));
  const [purchaseDate, setPurchaseDate] = useState<string>(startDate);
  const [calendarView, setCalendarView] = useState<"calendar" | "list">("calendar");
  const purchases = useSyncExternalStore(purchaseStore.subscribe, () => purchaseStore.getSnapshot(customerId), purchaseStore.getServerSnapshot);
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents(scenario));

  const baseEntries = useMemo(() => {
    const checkingAccountId = scenario.accounts[0]?.id ?? "";
    const recorded = pastPayments.map(payment => ({
      id: `payment-${payment.id}`,
      sourceId: payment.id,
      date: payment.date,
      kind: "payment" as const,
      label: payment.label,
      amountCents: payment.amountCents,
      accountId: payment.accountId || checkingAccountId,
      recurring: false,
    }));
    return [...scenarioEntries(scenario), ...recorded];
  }, [pastPayments, scenario]);
  const model = useMemo(() => buildCalendarModel(scenario, purchases, view, baseEntries), [scenario, purchases, view, baseEntries]);
  const accountNames = useMemo(() => Object.fromEntries(scenario.accounts.map((a) => [a.id, a.nickname])), [scenario]);
  const viewName = view === ALL_ACCOUNTS ? null : (accountNames[view] ?? null);

  function selectDay(date: ISODate) {
    setSelected(date);
    setMonth(monthStartOf(date));
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
      <header className="mb-7 text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="page-title">Weather Calendar</h1>
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
        <p className="mt-1.5 flex items-start justify-center gap-1.5 text-caption text-secondary">
          <Database aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {nessieSourceNote(scenario.customerName, scenario.asOfDate)} {forecastEstimateNote(scenario)} Purchases you add are saved in this browser for this customer.
        </p>
      </header>

      <StatsRow model={model} viewName={viewName} criticalBalanceCents={criticalBalanceCents} />
      <DebtSummary scenario={scenario} />

      <div className="mt-5 mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
          <div className="flex justify-end gap-1" role="group" aria-label="Calendar display">
            <button type="button" aria-pressed={calendarView === "calendar"} onClick={() => setCalendarView("calendar")} className="inline-flex min-h-10 items-center gap-2 rounded-item border border-app bg-card px-3 text-caption text-secondary aria-pressed:border-accent-line aria-pressed:bg-nav-active aria-pressed:text-accent">
              <CalendarDays aria-hidden className="size-4" /> Calendar
            </button>
            <button type="button" aria-pressed={calendarView === "list"} onClick={() => setCalendarView("list")} className="inline-flex min-h-10 items-center gap-2 rounded-item border border-app bg-card px-3 text-caption text-secondary aria-pressed:border-accent-line aria-pressed:bg-nav-active aria-pressed:text-accent">
              <List aria-hidden className="size-4" /> List
            </button>
          </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {calendarView === "calendar" ? (
            <MoneyCalendar model={model} month={month} selected={selected} viewName={viewName} criticalBalanceCents={criticalBalanceCents} onMonthChange={setMonth} onSelect={selectDay} onToday={goToday} />
          ) : (
            <CalendarListView model={model} selected={selected} accountNames={accountNames} onSelect={selectDay} />
          )}
          <SpendingChart model={model} selected={selected} month={month} />
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

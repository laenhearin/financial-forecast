"use client";

import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleUser, LogOut } from "lucide-react";
import { announceCustomerChange, type ActiveCustomer } from "@/components/layout/ActiveCustomer";
import { balanceSettingsStore } from "@/features/calendar/state/balanceSettingsStore";
import { formatDate } from "@/lib/dates";
import { centsToInputString, formatUSD, parseDollarsToCents } from "@/lib/money";

export type ProfileAccounts =
  | {
    ok: true;
    cash: { id: string; nickname: string; type: "checking" | "savings"; balanceCents: number }[];
    /** Card names from the customer's Nessie credit card accounts. */
    cards: string[];
    criticalDefaultCents: number;
    asOfDate: string;
  }
  | { ok: false; message: string };

const selectClass = "ui-transition min-h-11 rounded-chip border border-app bg-card px-3 text-body text-primary outline-none focus:border-accent-line focus:ring-2 focus:ring-accent/20";

export function ProfileView({ customers, active, accounts }: { customers: ActiveCustomer[]; active: ActiveCustomer; accounts: ProfileAccounts }) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const criticalDefaultCents = accounts.ok ? accounts.criticalDefaultCents : 0;
  const savedCriticalBalance = useSyncExternalStore(balanceSettingsStore.subscribe, () => balanceSettingsStore.getSnapshot(active.id), balanceSettingsStore.getServerSnapshot);
  // null follows the saved value; typing keeps the draft until it is saved or reset.
  const [criticalDraft, setCriticalDraft] = useState<string | null>(null);
  const [criticalBalanceError, setCriticalBalanceError] = useState<string | null>(null);
  const criticalBalanceInput = criticalDraft ?? centsToInputString(savedCriticalBalance ?? criticalDefaultCents);

  async function changeCustomer(customerId: string) {
    setNotice(null);
    setRequestedId(customerId);
    try {
      const response = await fetch("/api/active-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "The customer could not be changed.");
      }
      announceCustomerChange(customerId);
      startSwitch(() => router.refresh());
    } catch (error) {
      setRequestedId(null);
      setNotice(error instanceof Error ? error.message : "The customer could not be changed. Please try again.");
    }
  }

  function saveCriticalBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDollarsToCents(criticalBalanceInput);
    if (cents === null) {
      setCriticalBalanceError("Enter a valid amount of $0 or more, with up to two decimal places.");
      return;
    }
    balanceSettingsStore.setCriticalBalanceCents(active.id, cents);
    setCriticalDraft(null);
    setCriticalBalanceError(null);
    setNotice("Critical balance setting saved for this customer.");
  }

  function resetCriticalBalance() {
    balanceSettingsStore.setCriticalBalanceCents(active.id, null);
    setCriticalDraft(null);
    setCriticalBalanceError(null);
    setNotice("Critical balance reset to this customer's housing bill.");
  }

  return (
    <div className="mx-auto w-full max-w-180 px-5 py-12 md:px-10">
      <header className="mb-7">
        <h1 className="text-display font-medium text-primary">Profile</h1>
        <p className="mt-2 text-body text-secondary">The Nessie customer every Financial Forecast page reads from.</p>
      </header>

      <section aria-label="Profile details" className="rounded-panel border border-app bg-card p-5 md:p-6">
        <div className="flex items-center gap-3 border-b border-app pb-5">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CircleUser aria-hidden className="size-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lead font-semibold text-primary">{active.name}</h2>
            <p className="mt-0.5 truncate text-caption text-secondary">Nessie customer {active.id}</p>
          </div>
        </div>

        <div className="py-5">
          <h3 className="text-caption font-medium text-secondary">Accounts read from Nessie</h3>
          {accounts.ok ? (
            <>
              {accounts.cash.length ? (
                <ul className="mt-2 rounded-item border border-app">
                  {accounts.cash.map(account => (
                    <li key={account.id} className="flex items-center justify-between gap-3 border-t border-app px-3 py-2.5 first:border-t-0">
                      <span className="min-w-0">
                        <span className="block truncate text-body font-medium text-primary">{account.nickname}</span>
                        <span className="block text-micro text-secondary capitalize">{account.type}</span>
                      </span>
                      <span className="shrink-0 text-body font-semibold text-primary">{formatUSD(account.balanceCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-caption text-secondary">No checking or savings accounts.</p>}
              <p className="mt-2 text-micro text-secondary">
                Cards: {accounts.cards.length ? accounts.cards.join(", ") : "none recognized from this customer's credit card accounts"}. Balances as of {formatDate(accounts.asOfDate, "full")}.
              </p>
            </>
          ) : <p role="alert" className="mt-2 text-caption text-neg">{accounts.message}</p>}
        </div>

        <div className="flex flex-col gap-3 border-t border-app pt-5 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-caption font-medium text-secondary">
            Change Nessie customer
            <select
              value={requestedId ?? active.id}
              disabled={switching}
              onChange={(event) => changeCustomer(event.target.value)}
              className={selectClass}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setNotice("Financial Forecast has no sign-in yet. Choose another Nessie customer above to switch.")}
            className="ui-transition inline-flex min-h-11 items-center justify-center gap-2 rounded-chip border border-app px-3 py-2 text-caption font-medium text-secondary hover:border-neg hover:bg-neg-soft hover:text-neg"
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </div>

        {(notice || switching) && (
          <p role="status" className="mt-4 rounded-item bg-secondary px-3 py-2.5 text-caption text-secondary">
            {switching ? "Loading this customer's Nessie data…" : notice}
          </p>
        )}
        <p className="mt-4 text-micro text-secondary">
          Nessie is a mock banking sandbox, not a real bank connection. Every page, the shell, and the assistant use the customer chosen here.
        </p>
      </section>

      {accounts.ok && (
        <section aria-labelledby="settings-title" className="mt-5 rounded-panel border border-app bg-card p-5 md:p-6">
          <h2 id="settings-title" className="text-lead font-semibold text-primary">Settings</h2>
          <p className="mt-1.5 text-caption text-secondary">Set the balance Financial Forecast treats as critical. By default, that is this customer&apos;s housing bill from Nessie.</p>
          <form onSubmit={saveCriticalBalance} className="mt-5 max-w-xl">
            <label htmlFor="critical-balance" className="mb-1.5 block text-caption font-medium text-secondary">Critical balance ($)</label>
            <div className="flex flex-wrap gap-3">
              <input
                id="critical-balance"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={criticalBalanceInput}
                onChange={(event) => setCriticalDraft(event.target.value)}
                className={`${selectClass} min-w-0 flex-1`}
              />
              <button type="submit" className="ui-transition min-h-11 rounded-chip bg-accent-soft px-4 text-caption font-semibold text-primary hover:bg-nav-active">Save threshold</button>
              <button type="button" onClick={resetCriticalBalance} className="ui-transition min-h-11 rounded-chip border border-app px-4 text-caption font-medium text-secondary hover:bg-nav-hover">Use housing bill</button>
            </div>
            {criticalBalanceError && <p role="alert" className="mt-2 text-caption text-neg">{criticalBalanceError}</p>}
            <p className="mt-3 text-micro text-secondary">
              Current threshold: {formatUSD(savedCriticalBalance ?? criticalDefaultCents)}. At or below is CRITICAL; +$200 is CAUTION, +$700 is STABLE, and +$1,200 is THRIVING.
            </p>
          </form>
        </section>
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { isISODate } from "@/lib/dates";
import { parseDollarsToCents } from "@/lib/money";
import type { AccountSnapshot } from "../../big-purchase/types";
import { PURCHASE_NAME_MAX_LENGTH } from "../config";
import { ALL_ACCOUNTS, type AccountView, type ISODate, type UserPurchase } from "../types";
import { inputClass, labelClass, noteClass, panelClass, panelTitleClass, primaryButtonClass, subtitleClass } from "./ui";

interface AddPurchasePanelProps {
  accounts: AccountSnapshot[];
  /** The form's date follows the selected calendar day. */
  date: string;
  onDateChange: (date: string) => void;
  view: AccountView;
  onViewChange: (view: AccountView) => void;
  onAdd: (purchase: Omit<UserPurchase, "id">) => void;
}

export function AddPurchasePanel({ accounts, date, onDateChange, view, onViewChange, onAdd }: AddPurchasePanelProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const viewName = accounts.find((a) => a.id === view)?.nickname;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = name.trim();
    const amountCents = parseDollarsToCents(amount);
    if (!label || amountCents === null || amountCents <= 0 || !isISODate(date)) {
      setError("Enter a purchase name, valid amount, and date.");
      return;
    }
    onAdd({ label, amountCents, date: date as ISODate, accountId });
    setName("");
    setAmount("");
    setError(null);
  }

  return (
    <section aria-labelledby="add-purchase-title" className={panelClass}>
      <h2 id="add-purchase-title" className={panelTitleClass}>
        Add a purchase
      </h2>
      <p className={subtitleClass}>Record an unplanned expense</p>

      <form onSubmit={handleSubmit} noValidate className="mt-4.5 flex flex-col gap-3">
        <div>
          <label htmlFor="purchase-name" className={labelClass}>
            What did you buy?
          </label>
          <input id="purchase-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={PURCHASE_NAME_MAX_LENGTH} placeholder="e.g. Groceries" className={inputClass} />
        </div>
        <div>
          <label htmlFor="purchase-amount" className={labelClass}>
            Amount ($)
          </label>
          <input id="purchase-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" className={inputClass} />
        </div>
        <div>
          <label htmlFor="purchase-date" className={labelClass}>
            Purchase date
          </label>
          <input id="purchase-date" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="purchase-account" className={labelClass}>
            Charge purchase to
          </label>
          <select id="purchase-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.nickname}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="text-caption text-neg">
            {error}
          </p>
        )}
        <button type="submit" className={primaryButtonClass}>
          + Add purchase
        </button>
      </form>
      <p className={noteClass}>Purchases go to the account chosen in this form, whichever calendar view is showing. They are saved in this browser for the selected demo profile.</p>

      <div className="mt-5 border-t border-app pt-4.5">
        <label htmlFor="account-view" className="mb-2 block text-caption font-semibold text-primary">
          Accounts being viewed
        </label>
        <select id="account-view" value={view} onChange={(e) => onViewChange(e.target.value)} className={inputClass}>
          <option value={ALL_ACCOUNTS}>All accounts combined</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.nickname}
            </option>
          ))}
        </select>
        <p className="mt-2 text-caption font-medium text-primary">{viewName ? `Viewing ${viewName}` : "Viewing all accounts"}</p>
        <p className="mt-2 text-micro text-secondary">
          Choose an account to see its own calendar, transactions, projected balance and weekly spending graph.
        </p>
      </div>
    </section>
  );
}

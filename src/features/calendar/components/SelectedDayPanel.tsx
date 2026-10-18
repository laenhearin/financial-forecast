"use client";

import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FORECAST_DAYS } from "../config";
import { isIncoming } from "../engine/entries";
import { dayAlert, endOfDayBalance, type CalendarModel, type DayAlert } from "../engine/model";
import { balanceLevel } from "../engine/balanceThresholds";
import { formatWeekday } from "../format";
import type { CalendarEntry, ISODate } from "../types";
import { panelClass, panelTitleClass, removeButtonClass, subtitleClass } from "./ui";

const ALERT_BG: Record<DayAlert["tone"], string> = { safe: "bg-pos-soft", caution: "bg-rain-soft", danger: "bg-neg-soft" };

function kindText(entry: CalendarEntry): string {
  switch (entry.kind) {
    case "income":
      return "Money received";
    case "bill":
      return "Bill · Upcoming";
    case "planned":
      return "Planned expense";
    case "estimate":
      return `Estimate · ${entry.detail ?? "Everyday spending"}`;
    case "purchase":
      return "Purchase · Added by you";
    case "payment":
      return "Payment · Recorded";
    case "received":
      return "Money received · Recorded";
  }
}

interface SelectedDayPanelProps {
  model: CalendarModel;
  date: ISODate;
  accountNames: Record<string, string>;
  criticalBalanceCents: number;
  onRemovePurchase: (id: string, date: ISODate, deleteFuturePayments: boolean) => void;
}

export function SelectedDayPanel({ model, date, accountNames, criticalBalanceCents, onRemovePurchase }: SelectedDayPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<CalendarEntry | null>(null);
  const entries = model.entriesByDate.get(date) ?? [];
  const endOfDay = endOfDayBalance(model, date);
  const balance = endOfDay?.cents ?? null;
  const alert = dayAlert(model, date, criticalBalanceCents);
  const isPast = date < model.asOfDate;

  return (
    <section aria-labelledby="selected-day-title" className={panelClass}>
      <h2 id="selected-day-title" className={panelTitleClass}>
        {formatDate(date, "long")}
      </h2>
      <p className={subtitleClass}>{formatWeekday(date)}</p>

      <p aria-live="polite" className={cn("mt-4 rounded-item px-3.5 py-3 text-caption text-primary", ALERT_BG[alert.tone])}>
        {alert.text}
      </p>

      <p className="mt-4 text-caption text-secondary">{isPast ? "Balance at the end of this day" : "Projected balance after this day"}</p>
      <p className={cn("mt-1 text-display font-semibold", balance !== null && balanceLevel(balance, criticalBalanceCents) >= 4 ? "text-neg" : "text-primary")}>
        {balance !== null ? formatUSD(balance) : isPast ? "Past date" : "Outside forecast"}
      </p>
      <p className="mt-1 text-micro text-secondary">
        {endOfDay?.recorded ? "Rebuilt from recorded Nessie transactions" : balance !== null ? "After scheduled transactions" : isPast ? "Before the recorded history" : `Forecast covers ${FORECAST_DAYS} days from today`}
      </p>

      <hr className="my-5 border-app" />
      <h3 className="mb-1 text-body font-semibold text-primary">Bills, purchases and income</h3>
      {entries.length === 0 ? (
        <p className="py-3 text-caption text-secondary">No bills, purchases, or incoming money for this day.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2.5 border-b border-app py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="text-caption font-semibold text-primary">{entry.label}</p>
                <p className="mt-1 text-micro text-secondary">
                  {kindText(entry)} · {accountNames[entry.accountId] ?? "Account"}
                  {entry.recurring ? " · Recurring" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("text-caption font-semibold whitespace-nowrap", isIncoming(entry) ? "text-pos" : "text-primary")}>
                  {isIncoming(entry) ? "+" : "−"}
                  {formatUSD(entry.amountCents)}
                </p>
                {entry.kind === "purchase" && (
                  <button
                    type="button"
                    onClick={() => entry.recurring ? setPendingDelete(entry) : onRemovePurchase(entry.sourceId, entry.date, true)}
                    aria-label={`Delete ${entry.label}`}
                    className={cn(removeButtonClass, "mt-1")}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent showCloseButton={false} className="gap-5 border border-app bg-card text-primary sm:max-w-md">
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-body font-semibold">Delete future payments?</DialogTitle>
            <DialogDescription className="text-caption text-secondary">
              {pendingDelete ? `${pendingDelete.label} is a monthly purchase. Choose whether to delete only this payment or this and all later payments.` : "Choose which payments to delete."}
            </DialogDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setPendingDelete(null)} className="rounded-item border border-app bg-card px-3 py-2 text-caption text-primary hover:bg-nav-hover">Cancel</button>
            <button
              type="button"
              onClick={() => { if (pendingDelete) onRemovePurchase(pendingDelete.sourceId, pendingDelete.date, false); setPendingDelete(null); }}
              className="rounded-item border border-app bg-card px-3 py-2 text-caption text-primary hover:bg-nav-hover"
            >
              Delete this payment
            </button>
            <button
              type="button"
              onClick={() => { if (pendingDelete) onRemovePurchase(pendingDelete.sourceId, pendingDelete.date, true); setPendingDelete(null); }}
              className="rounded-item border border-neg bg-neg-soft px-3 py-2 text-caption font-medium text-neg hover:opacity-80"
            >
              Delete this and future payments
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

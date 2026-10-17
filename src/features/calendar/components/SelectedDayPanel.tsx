import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { FORECAST_DAYS } from "../config";
import { balanceOn, dayAlert, type CalendarModel, type DayAlert } from "../engine/model";
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
  }
}

interface SelectedDayPanelProps {
  model: CalendarModel;
  date: ISODate;
  accountNames: Record<string, string>;
  criticalBalanceCents: number;
  onRemovePurchase: (id: string) => void;
}

export function SelectedDayPanel({ model, date, accountNames, criticalBalanceCents, onRemovePurchase }: SelectedDayPanelProps) {
  const entries = model.entriesByDate.get(date) ?? [];
  const balance = balanceOn(model, date);
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

      <p className="mt-4 text-caption text-secondary">Projected balance after this day</p>
      <p className={cn("mt-1 text-display font-semibold", balance !== null && balanceLevel(balance, criticalBalanceCents) >= 4 ? "text-neg" : "text-primary")}>
        {balance !== null ? formatUSD(balance) : isPast ? "Past date" : "Outside forecast"}
      </p>
      <p className="mt-1 text-micro text-secondary">
        {balance !== null ? "After scheduled transactions" : isPast ? "Forecast starts from today" : `Forecast covers ${FORECAST_DAYS} days from today`}
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
                <p className={cn("text-caption font-semibold whitespace-nowrap", entry.kind === "income" ? "text-pos" : "text-primary")}>
                  {entry.kind === "income" ? "+" : "−"}
                  {formatUSD(entry.amountCents)}
                </p>
                {entry.kind === "purchase" && (
                  <button type="button" onClick={() => onRemovePurchase(entry.id)} aria-label={`Remove ${entry.label}`} className={cn(removeButtonClass, "mt-1")}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

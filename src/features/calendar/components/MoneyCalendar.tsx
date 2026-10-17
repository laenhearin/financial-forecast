import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MAX_CHIPS_PER_DAY } from "../config";
import { monthGrid, shiftMonth, WEEKDAY_NAMES } from "../engine/grid";
import { balanceOn, type CalendarModel, type RiskLevel } from "../engine/model";
import { BALANCE_LABELS, balanceLevel } from "../engine/balanceThresholds";
import { formatMonthYear, formatWeekday, plural } from "../format";
import type { CalendarEntry, ISODate } from "../types";
import { noteClass, panelClass, panelTitleClass, secondaryButtonClass, subtitleClass } from "./ui";

/** Day background per risk level; 0 is a plain card. */
const RISK_BG: Record<RiskLevel, string> = {
  0: "bg-card",
  1: "cal-risk-1 cal-rain",
  2: "cal-risk-2 cal-rain",
  3: "cal-risk-3 cal-rain",
  4: "cal-risk-4 cal-storm",
  5: "cal-risk-5 cal-storm",
};

const CHIP_STYLE: Record<CalendarEntry["kind"], string> = {
  income: "bg-pos-soft",
  bill: "bg-accent-soft",
  planned: "bg-accent-soft",
  purchase: "border border-app bg-card",
  estimate: "border border-dashed border-app bg-card",
};

function chipText(entry: CalendarEntry): string {
  switch (entry.kind) {
    case "income":
      return `+${formatUSD(entry.amountCents)}`;
    case "bill":
      return `Bill · ${entry.label}`;
    case "planned":
      return `Plan · ${entry.label}`;
    case "purchase":
      return `Buy · ${entry.label}`;
    case "estimate":
      return "Est. · Spending";
  }
}

export const entryTitle = (entry: CalendarEntry) => `${entry.label}: ${entry.kind === "income" ? "+" : "−"}${formatUSD(entry.amountCents)}`;

interface DayCellProps {
  model: CalendarModel;
  date: ISODate;
  month: ISODate;
  selected: boolean;
  criticalBalanceCents: number;
  onSelect: (date: ISODate) => void;
}

function DayCell({ model, date, month, selected, criticalBalanceCents, onSelect }: DayCellProps) {
  const entries = model.entriesByDate.get(date) ?? [];
  const balance = balanceOn(model, date);
  const risk = balanceLevel(balance, criticalBalanceCents);
  const isToday = date === model.asOfDate;
  const incoming = entries.filter((e) => e.kind === "income");
  const label = [
    `${formatWeekday(date)}, ${formatDate(date, "long")}`,
    isToday ? "Today" : null,
    balance !== null ? `Projected ${formatUSD(balance)}, ${BALANCE_LABELS[risk].toLowerCase()}` : null,
    plural(entries.length, "item"),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect(date)}
      className={cn(
        "ui-transition relative isolate min-h-20 min-w-0 overflow-hidden rounded-item border px-1 py-1.5 text-left text-primary sm:min-h-26 sm:px-2 sm:py-2",
        RISK_BG[risk],
        risk >= 4 ? "border-rain" : "border-app hover:border-accent-line",
        selected && "ring-2 ring-accent ring-inset",
        date.slice(0, 7) !== month.slice(0, 7) && "opacity-40",
      )}
    >
      {incoming.length > 0 && (
        <span
          title={incoming.map(entryTitle).join("\n")}
          className="absolute top-1.5 right-1.5 z-10 grid h-5.5 min-w-5.5 place-items-center rounded-full border border-pos bg-pos-soft px-1 text-micro font-bold text-pos"
        >
          ${incoming.length > 1 ? incoming.length : ""}
        </span>
      )}
      {risk > 0 && (
        <span aria-hidden className="absolute top-7 right-1.5 z-10 text-caption leading-none">
          {risk >= 4 ? "⛈️" : "⚠️"}
        </span>
      )}
      <span className="relative z-10 block">
        <span className={cn("inline-grid text-micro font-semibold", isToday && "size-6 place-items-center rounded-full border border-accent-line bg-nav-active")}>
          {Number(date.slice(8))}
        </span>
        <span className="mt-1.5 flex flex-col gap-1">
          {entries.slice(0, MAX_CHIPS_PER_DAY).map((entry) => (
            <span key={entry.id} title={entryTitle(entry)} className={cn("block truncate rounded-chip px-1 py-0.5 text-micro", CHIP_STYLE[entry.kind])}>
              {chipText(entry)}
            </span>
          ))}
          {entries.length > MAX_CHIPS_PER_DAY && <span className="block truncate px-1 text-micro">+{entries.length - MAX_CHIPS_PER_DAY} more</span>}
        </span>
        {balance !== null && <span className="mt-1.5 block truncate text-micro font-semibold">{formatUSD(balance)}</span>}
      </span>
    </button>
  );
}

function Legend() {
  const levels: RiskLevel[] = [0, 1, 2, 3, 4, 5];
  return (
    <div className="mt-4 flex flex-col gap-2 text-micro text-secondary">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span>Projected balance:</span>
        {levels.map((level) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <i aria-hidden className={cn("relative isolate inline-block size-3.5 overflow-hidden rounded-chip border border-app", RISK_BG[level])} />
            {level >= 4 ? `⛈️ ${BALANCE_LABELS[level]}` : BALANCE_LABELS[level]}
          </span>
        ))}
      </p>
      <p className="inline-flex items-center gap-1.5">
        <i aria-hidden className="inline-block size-3.5 rounded-chip border border-pos bg-pos-soft" />
        Green $ = incoming money
      </p>
    </div>
  );
}

interface MoneyCalendarProps {
  model: CalendarModel;
  month: ISODate;
  selected: ISODate;
  viewName: string | null;
  criticalBalanceCents: number;
  onMonthChange: (month: ISODate) => void;
  onSelect: (date: ISODate) => void;
  onToday: () => void;
}

export function MoneyCalendar({ model, month, selected, viewName, criticalBalanceCents, onMonthChange, onSelect, onToday }: MoneyCalendarProps) {
  return (
    <section aria-labelledby="money-calendar-title" className={panelClass}>
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="money-calendar-title" className={panelTitleClass}>
            Money calendar
          </h2>
          <p className={subtitleClass}>{viewName ? `${viewName} account forecast` : "Combined calendar for all accounts"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))} className={secondaryButtonClass}>
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
          <p aria-live="polite" className="min-w-36 text-center text-body font-semibold text-primary">
            {formatMonthYear(month)}
          </p>
          <button type="button" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))} className={secondaryButtonClass}>
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" onClick={onToday} className={cn(secondaryButtonClass, "border-accent-line bg-accent-soft font-medium")}>
            Today
          </button>
        </div>
      </div>

      <div aria-hidden className="mb-2 grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_NAMES.map((name) => (
          <span key={name} className="py-1.5 text-center text-micro font-semibold tracking-wide text-secondary uppercase">
            {name}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {monthGrid(month).map((date) => (
          <DayCell key={date} model={model} date={date} month={month} selected={date === selected} criticalBalanceCents={criticalBalanceCents} onSelect={onSelect} />
        ))}
      </div>

      <Legend />
      <p className={noteClass}>
        Calendar colors use projected balances after income, bills, estimated everyday spending and your purchases. Select a date to inspect its transactions.
      </p>
    </section>
  );
}

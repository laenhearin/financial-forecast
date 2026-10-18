import { ChevronLeft, ChevronRight, Cloud, CloudLightning, CloudRain, CloudSun, Sun, Zap, type LucideIcon } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MAX_CHIPS_PER_DAY } from "../config";
import { monthGrid, shiftMonth, WEEKDAY_NAMES } from "../engine/grid";
import { isIncoming } from "../engine/entries";
import { endOfDayBalance, type CalendarModel, type RiskLevel } from "../engine/model";
import { BALANCE_LABELS, balanceLevel } from "../engine/balanceThresholds";
import { formatMonthYear, formatWeekday, plural } from "../format";
import type { CalendarEntry, ISODate } from "../types";
import { noteClass, panelClass, panelTitleClass, secondaryButtonClass, subtitleClass } from "./ui";

/** The legend and forecast days share exactly the same balance colors. */
const RISK_BG: Record<RiskLevel, string> = {
  0: "cal-risk-0",
  1: "cal-risk-1",
  2: "cal-risk-2",
  3: "cal-risk-3 cal-rain",
  4: "cal-risk-4 cal-storm",
  5: "cal-risk-5 cal-storm",
};

const RISK_ICON: Record<RiskLevel, LucideIcon> = {
  0: Sun, 1: CloudSun, 2: Cloud, 3: CloudRain, 4: CloudLightning, 5: Zap,
};

const CHIP_STYLE: Record<CalendarEntry["kind"], string> = {
  income: "bg-pos-soft",
  bill: "bg-accent-soft",
  planned: "bg-accent-soft",
  purchase: "border border-app bg-card",
  payment: "bg-pos-soft text-pos",
  received: "bg-pos-soft",
  estimate: "border border-dashed border-app bg-card",
};

function chipText(entry: CalendarEntry): string {
  switch (entry.kind) {
    case "income":
    case "received":
      return `+${formatUSD(entry.amountCents)}`;
    case "bill":
      return `Bill · ${entry.label}`;
    case "planned":
      return `Plan · ${entry.label}`;
    case "purchase":
      return `Buy · ${entry.label}`;
    case "payment":
      return `Paid · ${formatUSD(entry.amountCents)}`;
    case "estimate":
      return "Est. · Spending";
  }
}

export const entryTitle = (entry: CalendarEntry) => `${entry.label}: ${isIncoming(entry) ? "+" : "−"}${formatUSD(entry.amountCents)}`;

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
  const endOfDay = endOfDayBalance(model, date);
  const balance = endOfDay?.cents ?? null;
  const risk = balanceLevel(balance, criticalBalanceCents);
  const WeatherIcon = RISK_ICON[risk];
  const isToday = date === model.asOfDate;
  const incoming = entries.filter(isIncoming);
  const label = [
    `${formatWeekday(date)}, ${formatDate(date, "long")}`,
    isToday ? "Today" : null,
    endOfDay ? `${endOfDay.recorded ? "Ended the day with" : "Projected"} ${formatUSD(endOfDay.cents)}, ${BALANCE_LABELS[risk].toLowerCase()}` : null,
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
        "ui-transition relative isolate min-h-20 min-w-0 overflow-hidden rounded-item border px-1 py-1.5 text-left sm:min-h-26 sm:px-2 sm:py-2",
        balance === null ? "border-app bg-card text-primary hover:border-accent-line" : cn("cal-balance-cell", RISK_BG[risk]),
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
      {balance !== null && (
        <WeatherIcon aria-hidden className="absolute top-7 right-1.5 z-10 size-3.5" strokeWidth={2} />
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
        {endOfDay && <span className="mt-1.5 block truncate text-micro font-semibold">{formatUSD(endOfDay.cents)}</span>}
      </span>
    </button>
  );
}

function Legend() {
  const levels: RiskLevel[] = [0, 1, 2, 3, 4, 5];
  return (
    <div className="mt-4 flex flex-col gap-2 text-micro text-secondary">
      <p className="font-medium text-primary">End-of-day balance</p>
      <ul aria-label="End-of-day balance levels" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {levels.map((level) => {
          const WeatherIcon = RISK_ICON[level];
          return (
            <li key={level} className={cn("cal-balance-cell relative isolate flex items-center gap-2 overflow-hidden rounded-item border px-2.5 py-2 text-micro font-semibold", RISK_BG[level])}>
              <WeatherIcon aria-hidden className="relative z-10 size-4 shrink-0" strokeWidth={2} />
              <span className="relative z-10">{BALANCE_LABELS[level]}</span>
            </li>
          );
        })}
      </ul>
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
        Each day shows the money left at the end of that day. Past days are rebuilt from recorded Nessie transactions; today onward is projected from income, bills, estimated everyday spending and your purchases. Select a date to inspect its transactions.
      </p>
    </section>
  );
}

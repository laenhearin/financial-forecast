import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { FORECAST_DAYS } from "../config";
import { atOrBelowShare, balanceOn, lowestBalance, upcomingBills, type CalendarModel } from "../engine/model";
import { plural } from "../format";
import { panelClass } from "./ui";

function Stat({ label, value, note, alert = false }: { label: string; value: string; note: string; alert?: boolean }) {
  return (
    <div className={panelClass}>
      <p className="text-caption text-secondary">{label}</p>
      <p className={cn("mt-2.5 text-display font-semibold", alert ? "text-neg" : "text-primary")}>{value}</p>
      <p className="mt-1.5 text-micro text-secondary">{note}</p>
    </div>
  );
}

export function StatsRow({ model, viewName }: { model: CalendarModel; viewName: string | null }) {
  const today = balanceOn(model, model.asOfDate) ?? model.startingCents;
  const bills = upcomingBills(model);
  const lowest = lowestBalance(model);
  const belowZero = lowest.cents < 0;
  const veryLow = !belowZero && atOrBelowShare(lowest.cents, model.startingCents, 25);
  const lowNote = belowZero
    ? "Warning: projected balance goes below $0"
    : veryLow
      ? "Warning: balance gets dangerously low"
      : `Across the next ${FORECAST_DAYS} days`;

  return (
    <section aria-label="Forecast summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stat
        label="Balance after today's transactions"
        value={formatUSD(today)}
        note={viewName ? `${viewName} balance after today's transactions` : "Combined balance after today's transactions"}
      />
      <Stat label="Upcoming unpaid bills" value={formatUSD(bills.totalCents)} note={`${plural(bills.count, "unpaid bill")} in forecast`} />
      <Stat
        label="Lowest projected balance"
        value={formatUSD(lowest.cents)}
        note={`${lowNote} · lowest on ${formatDate(lowest.date, "short")}`}
        alert={belowZero || veryLow}
      />
    </section>
  );
}

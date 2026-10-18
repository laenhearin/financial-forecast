import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import type { CalendarEntry, ISODate } from "../types";
import type { CalendarModel } from "../engine/model";
import { panelClass } from "./ui";

function entryKind(entry: CalendarEntry) {
  switch (entry.kind) {
    case "income": return "Income";
    case "bill": return "Bill";
    case "planned": return "Planned payment";
    case "purchase": return "Calendar purchase";
    case "payment": return "Recorded payment";
    case "estimate": return "Estimate";
  }
}

export function CalendarListView({ model, selected, accountNames, onSelect }: {
  model: CalendarModel;
  selected: ISODate;
  accountNames: Record<string, string>;
  onSelect: (date: ISODate) => void;
}) {
  const entries = model.entries.filter((entry) => entry.date >= model.asOfDate && entry.kind !== "estimate" && entry.kind !== "payment");

  return (
    <section aria-label="Chronological calendar list" className={panelClass}>
      <h2 className="text-body font-semibold text-primary">Upcoming bills and payments</h2>
      <p className="mt-1 text-caption text-secondary">Listed in date order. Select an item to inspect that day.</p>
      {entries.length === 0 ? (
        <p className="py-8 text-center text-caption text-secondary">No scheduled bills or payments in this forecast.</p>
      ) : (
        <ol className="mt-4 divide-y divide-app">
          {entries.map((entry) => {
            const IncomingIcon = entry.kind === "income" ? ArrowDownLeft : ArrowUpRight;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-pressed={entry.date === selected}
                  onClick={() => onSelect(entry.date)}
                  className="flex w-full items-center gap-3 rounded-item px-2.5 py-3 text-left hover:bg-nav-hover aria-pressed:bg-nav-active"
                >
                  <time dateTime={entry.date} className="w-20 shrink-0 text-caption font-medium text-primary">{formatDate(entry.date, "short")}</time>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary">
                    <IncomingIcon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption font-medium text-primary">{entry.label}</span>
                    <span className="mt-0.5 block text-micro text-secondary">
                      {entryKind(entry)} · {accountNames[entry.accountId] ?? "Account"}{entry.recurring ? " · Recurring" : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 text-caption font-semibold ${entry.kind === "income" ? "text-pos" : "text-primary"}`}>
                    {entry.kind === "income" ? "+" : "−"}{formatUSD(entry.amountCents)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

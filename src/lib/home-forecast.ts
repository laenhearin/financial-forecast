import { projectBase } from "../features/big-purchase/engine/base";
import { scenarioEntries } from "../features/calendar/engine/entries";
import type { Scenario } from "../features/big-purchase/types";
import type { HomeData } from "../components/home/types";
import { daysBetween } from "./dates";

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

/** Adapt the selected profile without mixing in the static home fixture. */
export function buildHomeForecast(scenario: Scenario): HomeData {
    const base = projectBase(scenario);
    const projection = base.days.slice(0, 31).map((point, day) => ({ day, balanceCents: point.baseCents }));
    const low = projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
    const entries = scenarioEntries(scenario);
    const markers = entries
      .filter((entry) => entry.kind === "bill")
      .map((entry) => ({ day: daysBetween(scenario.asOfDate, entry.date), label: entry.label }))
      .filter((marker) => marker.day > 0 && marker.day <= 30);
    return {
      cards: [],
      asOfDate: scenario.asOfDate,
      isSampleData: true,
      userName: scenario.customerName,
      nextStormLabel: low.day > 0 ? weekday(base.days[low.day].date) : null,
      availableBalanceCents: base.startingCashCents,
      projection,
      markers,
    };
}

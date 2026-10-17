import { addDays, daysBetween, fromDayNumber, toDayNumber } from "../../../lib/dates";
import type { Cents, ISODate, Scenario, ScenarioMods } from "../types";
import { buildEvents, forecastRange } from "./events";
import { occurrences } from "./schedule";

export interface BaseDay { date: ISODate; baseCents: Cents }

export interface BaseProjection {
  asOfDate: ISODate;
  horizonEndDate: ISODate;
  startingCashCents: Cents;
  /** Day 0 is the as-of date; one entry per day through the horizon end. */
  days: BaseDay[];
  /** Paycheck dates strictly after the as-of date, deduplicated and ascending. */
  paydays: ISODate[];
}

export function startingCash(scenario: Scenario): Cents {
  return scenario.accounts.filter(account => account.includeInForecast).reduce((sum, account) => sum + account.balanceCents, 0);
}

/** End-of-day cash with no goal, for every day of the horizon. */
export function projectBase(scenario: Scenario, mods: ScenarioMods = {}): BaseProjection {
  const { asOfDate, horizonEndDate } = forecastRange(scenario.asOfDate);
  const start = toDayNumber(asOfDate);
  const deltas = new Array<number>(daysBetween(asOfDate, horizonEndDate) + 1).fill(0);
  for (const event of buildEvents(scenario, mods)) deltas[toDayNumber(event.date) - start] += event.deltaCents;

  const startingCashCents = startingCash(scenario);
  let balance = startingCashCents;
  const days = deltas.map((delta, index) => {
    balance += delta;
    if (!Number.isSafeInteger(balance)) throw new Error("Projected balance exceeds the supported range.");
    return { date: fromDayNumber(start + index), baseCents: balance };
  });

  return { asOfDate, horizonEndDate, startingCashCents, days, paydays: paydaysFor(scenario) };
}

export function paydaysFor(scenario: Scenario): ISODate[] {
  const { asOfDate, horizonEndDate } = forecastRange(scenario.asOfDate);
  const dates = new Set<ISODate>();
  for (const income of scenario.income) {
    if (!income.isPaycheck) continue;
    for (const date of occurrences(income.schedule, addDays(asOfDate, 1), horizonEndDate)) dates.add(date);
  }
  return [...dates].sort();
}

import { addDays, addMonths, dayOfWeek, fromDayNumber, toDayNumber } from "../../../lib/dates";
import { HORIZON_MONTHS, SPENDING_WEEKDAY } from "../config";
import type { Cents, ISODate, Scenario, ScenarioMods, Schedule } from "../types";
import { occurrences } from "./schedule";

export interface CashEvent {
  date: ISODate;
  /** Signed: positive adds cash, negative removes it. Internal to the engine only. */
  deltaCents: Cents;
  kind: "income" | "bill" | "spending" | "one-off";
  sourceId: string;
  label: string;
}

export interface ForecastRange { asOfDate: ISODate; horizonEndDate: ISODate }

export function forecastRange(asOfDate: ISODate): ForecastRange {
  return { asOfDate, horizonEndDate: addMonths(asOfDate, HORIZON_MONTHS) };
}

/** Weekly spending amount for a category, after any cut, in cents. */
export function weeklySpendingCents(monthlyAmountCents: Cents, cutPercent = 0): Cents {
  return Math.round((monthlyAmountCents * 12 * (100 - cutPercent)) / 5200);
}

/**
 * Signed, dated events from income, bills, spending, and one-offs, for the days after the
 * as-of date through the horizon. Items dated on the as-of date are already in the balance.
 */
export function buildEvents(scenario: Scenario, mods: ScenarioMods = {}): CashEvent[] {
  const { asOfDate, horizonEndDate } = forecastRange(scenario.asOfDate);
  const from = addDays(asOfDate, 1);
  const removed = new Set(mods.removedBillIds ?? []);
  const events: CashEvent[] = [];

  for (const income of scenario.income) {
    for (const date of occurrences(income.schedule, from, horizonEndDate)) {
      events.push({ date, deltaCents: income.amountCents, kind: "income", sourceId: income.id, label: income.label });
    }
  }

  for (const bill of scenario.bills) {
    if (removed.has(bill.id)) continue;
    for (const date of occurrences(withDueDay(bill.schedule, mods.billDueDays?.[bill.id]), from, horizonEndDate)) {
      events.push({ date, deltaCents: -bill.amountCents, kind: "bill", sourceId: bill.id, label: bill.label });
    }
  }

  const firstSaturday = toDayNumber(from) + ((SPENDING_WEEKDAY - dayOfWeek(from) + 7) % 7);
  for (const category of scenario.spending) {
    const weekly = weeklySpendingCents(category.monthlyAmountCents, mods.categoryCutPercents?.[category.id] ?? 0);
    if (weekly === 0) continue;
    for (let day = firstSaturday; day <= toDayNumber(horizonEndDate); day += 7) {
      events.push({ date: fromDayNumber(day), deltaCents: -weekly, kind: "spending", sourceId: category.id, label: category.label });
    }
  }

  for (const oneOff of scenario.oneOffs) {
    if (oneOff.date < from || oneOff.date > horizonEndDate) continue;
    events.push({
      date: oneOff.date,
      deltaCents: oneOff.type === "income" ? oneOff.amountCents : -oneOff.amountCents,
      kind: "one-off",
      sourceId: oneOff.id,
      label: oneOff.label,
    });
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function withDueDay(schedule: Schedule, dueDay: number | undefined): Schedule {
  if (dueDay === undefined) return schedule;
  if (schedule.frequency !== "monthly") throw new Error("Only monthly bills can move to a new due day.");
  return { ...schedule, dayOfMonth: dueDay };
}

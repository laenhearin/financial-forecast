import { addDays, addMonths, dayOfWeek } from "../../../lib/dates";
import type { ISODate } from "../types";

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "2026-10-17" -> "2026-10-01". */
export function monthStartOf(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function shiftMonth(monthStart: ISODate, months: number): ISODate {
  return addMonths(monthStart, months);
}

/** Days since the Monday that starts the week (Monday 0 through Sunday 6). */
function mondayOffset(date: ISODate): number {
  return (dayOfWeek(date) + 6) % 7;
}

/** Six Monday-first weeks (42 days) covering the month. */
export function monthGrid(monthStart: ISODate): ISODate[] {
  const first = addDays(monthStart, -mondayOffset(monthStart));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** Monday through Sunday of the week containing the date. */
export function weekDates(date: ISODate): ISODate[] {
  const monday = addDays(date, -mondayOffset(date));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

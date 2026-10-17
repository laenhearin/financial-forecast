import { assertISODate, clampedDate, dateParts, fromDayNumber, toDayNumber } from "../../../lib/dates";
import type { ISODate, Schedule } from "../types";

/** Every date a schedule fires between `from` and `to`, inclusive, in ascending order. */
export function occurrences(schedule: Schedule, from: ISODate, to: ISODate): ISODate[] {
  assertISODate(from);
  assertISODate(to);
  if (to < from) return [];
  switch (schedule.frequency) {
    case "once": {
      const anchor = requireAnchor(schedule);
      return anchor >= from && anchor <= to ? [anchor] : [];
    }
    case "weekly":
      return everyNDays(requireAnchor(schedule), 7, from, to);
    case "biweekly":
      return everyNDays(requireAnchor(schedule), 14, from, to);
    case "monthly":
      return monthlyOn([requireDay(schedule.dayOfMonth)], from, to);
    case "semimonthly":
      return monthlyOn([requireDay(schedule.dayOfMonth), requireDay(schedule.secondDayOfMonth)], from, to);
    case "yearly": {
      const anchor = dateParts(requireAnchor(schedule));
      const dates: ISODate[] = [];
      for (let year = dateParts(from).year; year <= dateParts(to).year; year++) {
        const date = clampedDate(year, anchor.month, anchor.day);
        if (date >= from && date <= to) dates.push(date);
      }
      return dates;
    }
    default:
      throw new Error(`Unknown schedule frequency "${String((schedule as Schedule).frequency)}".`);
  }
}

function requireAnchor(schedule: Schedule): ISODate {
  if (!schedule.anchorDate) throw new Error(`A ${schedule.frequency} schedule needs an anchorDate.`);
  assertISODate(schedule.anchorDate);
  return schedule.anchorDate;
}

function requireDay(day: number | undefined): number {
  if (day === undefined || !Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("Day of month must be an integer from 1 to 31.");
  }
  return day;
}

function everyNDays(anchor: ISODate, step: number, from: ISODate, to: ISODate): ISODate[] {
  const anchorDay = toDayNumber(anchor);
  const first = anchorDay + Math.ceil((toDayNumber(from) - anchorDay) / step) * step;
  const last = toDayNumber(to);
  const dates: ISODate[] = [];
  for (let day = first; day <= last; day += step) dates.push(fromDayNumber(day));
  return dates;
}

function monthlyOn(days: number[], from: ISODate, to: ISODate): ISODate[] {
  const start = dateParts(from);
  const end = dateParts(to);
  const dates = new Set<ISODate>();
  for (let index = start.year * 12 + start.month - 1; index <= end.year * 12 + end.month - 1; index++) {
    for (const day of days) {
      const date = clampedDate(Math.floor(index / 12), (index % 12) + 1, day);
      if (date >= from && date <= to) dates.add(date);
    }
  }
  return [...dates].sort();
}

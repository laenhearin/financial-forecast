import {
  addDays,
  addMonths,
  clampedDate,
  dateParts,
  daysBetween,
  daysInMonth,
  formatDate,
  isISODate,
  maxDate,
  minDate,
} from "../dates";
import type { DateRange, RangePreset } from "./types";

function monthRange(date: string): DateRange {
  const { year, month } = dateParts(date);
  return {
    start: clampedDate(year, month, 1),
    end: clampedDate(year, month, 31),
  };
}
export function resolveRange(
  preset: RangePreset,
  today: string,
  custom?: DateRange,
): DateRange {
  const { year } = dateParts(today);
  switch (preset) {
    case "custom":
      return custom ?? monthRange(today);
    case "this-month":
      return monthRange(today);
    case "last-month":
      return monthRange(addMonths(today, -1));
    case "this-year":
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    case "last-year":
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
  }
}
export function getPreviousRange(
  range: DateRange,
  preset: RangePreset,
): DateRange {
  if (preset.endsWith("month")) return monthRange(addMonths(range.start, -1));
  if (preset.endsWith("year")) {
    const year = dateParts(range.start).year - 1;
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  return {
    start: addDays(range.start, -(daysBetween(range.start, range.end) + 1)),
    end: addDays(range.start, -1),
  };
}
export function validateRange(range: DateRange): {
  valid: boolean;
  error?: string;
} {
  if (
    !isISODate(range.start) ||
    !isISODate(range.end) ||
    range.start < "0100-01-01" ||
    range.end > "9998-12-31"
  )
    return { valid: false, error: "Choose valid start and end dates." };
  if (range.start > range.end)
    return { valid: false, error: "Start date must be on or before end date." };
  if (daysBetween(range.start, range.end) >= 366)
    return { valid: false, error: "Choose a range of at most 366 days." };
  return { valid: true };
}
export function forecastWindow(
  range: DateRange,
  today: string,
): DateRange | undefined {
  return range.end < today
    ? undefined
    : {
        start: today,
        end: minDate(maxDate(range.end, addDays(today, 6)), addDays(today, 30)),
      };
}
export function rangeLabel(range: DateRange): string {
  return `${formatDate(range.start, "short")} ${range.start.slice(0, 4)} to ${formatDate(range.end, "short")} ${range.end.slice(0, 4)}`;
}
export function reportTitle(range: DateRange): string {
  const { year, month, day } = dateParts(range.start);
  if (range.start === `${year}-01-01` && range.end === `${year}-12-31`)
    return `Annual Report: ${year}`;
  if (
    day === 1 &&
    range.end === clampedDate(year, month, daysInMonth(year, month))
  )
    return `Monthly Report: ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${range.start}T12:00:00Z`))}`;
  return `Financial Report: ${rangeLabel(range)}`;
}

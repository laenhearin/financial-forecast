/**
 * UTC calendar-date helpers. Dates are "YYYY-MM-DD" strings and every calculation
 * runs in UTC, so results never depend on the local timezone. Nothing here reads the clock.
 */
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export interface DateParts { year: number; month: number; day: number }

export function isISODate(value: string): boolean {
  const match = ISO_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(Number(y), month);
}

export function assertISODate(value: string): void {
  if (!isISODate(value)) throw new Error(`Expected a YYYY-MM-DD calendar date, got "${value}".`);
}

export function dateParts(value: string): DateParts {
  assertISODate(value);
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) };
}

/** Month is 1 to 12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Builds a date, clamping the day to the last day of short months (day 31 in April becomes April 30). */
export function clampedDate(year: number, month: number, day: number): string {
  const safeDay = Math.min(Math.max(1, day), daysInMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

/** Days since 1970-01-01, useful for fast loops and subtraction. */
export function toDayNumber(value: string): number {
  const { year, month, day } = dateParts(value);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function fromDayNumber(dayNumber: number): string {
  if (!Number.isSafeInteger(dayNumber)) throw new Error("Day number must be an integer.");
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  return fromDayNumber(toDayNumber(value) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Adds calendar months, clamping to the last day of the target month. */
export function addMonths(value: string, months: number): string {
  const { year, month, day } = dateParts(value);
  const index = year * 12 + (month - 1) + months;
  return clampedDate(Math.floor(index / 12), (index % 12) + 1, day);
}

/** 0 = Sunday through 6 = Saturday. */
export function dayOfWeek(value: string): number {
  return (((toDayNumber(value) + 4) % 7) + 7) % 7;
}

export function minDate(a: string, b: string): string { return a <= b ? a : b; }
export function maxDate(a: string, b: string): string { return a >= b ? a : b; }

/** Milliseconds at UTC midnight, for chart axes. */
export function toUTCms(value: string): number {
  return toDayNumber(value) * MS_PER_DAY;
}

const formatters = {
  short: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  long: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }),
  full: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
  monthYear: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
};

/** short: "Mar 14"; long: "March 14"; full: "March 14, 2027"; monthYear: "Mar 2027". */
export function formatDate(value: string, style: keyof typeof formatters = "long"): string {
  assertISODate(value);
  return formatters[style].format(new Date(toUTCms(value)));
}

/** 1 -> "1st", 22 -> "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

import { assertISODate, toUTCms } from "../../lib/dates";

/** UTC formatters, so server and browser render the same text. */
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });

/** "October 2026". */
export function formatMonthYear(date: string): string {
  assertISODate(date);
  return monthYear.format(new Date(toUTCms(date)));
}

/** "Saturday". */
export function formatWeekday(date: string): string {
  assertISODate(date);
  return weekday.format(new Date(toUTCms(date)));
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

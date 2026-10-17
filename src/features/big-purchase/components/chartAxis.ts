import { addDays, addMonths, dateParts, formatDate, fromDayNumber, minDate, toUTCms } from "@/lib/dates";
import type { Forecast } from "../types";

const MS_PER_DAY = 86_400_000;

export interface ChartRange { start: string; end: string; domain: [number, number]; ticks: number[] }

/** Shared x-axis for both charts: as-of date to four weeks past the affordable date (or the horizon end). */
export function chartRange(forecast: Forecast): ChartRange {
  const start = forecast.asOfDate;
  const target = forecast.plan.affordableNow ? addMonths(start, 2) : forecast.plan.affordableDate ? addDays(forecast.plan.affordableDate, 28) : forecast.horizonEndDate;
  const end = minDate(target, forecast.horizonEndDate);
  const months = (dateParts(end).year - dateParts(start).year) * 12 + dateParts(end).month - dateParts(start).month;
  const every = months > 12 ? 3 : months > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let m = 1; m <= months; m += every) {
    const { year, month } = dateParts(addMonths(start, m));
    ticks.push(toUTCms(`${year}-${String(month).padStart(2, "0")}-01`));
  }
  return { start, end, domain: [toUTCms(start), toUTCms(end)], ticks };
}

export function msToISO(ms: number): string {
  return fromDayNumber(Math.round(ms / MS_PER_DAY));
}

export function formatTick(ms: number): string {
  const iso = msToISO(ms);
  return dateParts(iso).month === 1 ? formatDate(iso, "monthYear") : formatDate(iso, "short").split(" ")[0];
}

import type { Cents, ISODate } from "../types";
import { addDays, dateParts, daysInMonth } from "../../../lib/dates";
import { isIncoming } from "./entries";
import { monthStartOf, weekDates } from "./grid";
import type { CalendarModel } from "./model";

export interface WeekDaySpending {
  date: ISODate;
  spendingCents: Cents;
}

/** Money going out each day of the selected week: bills, planned costs, estimates, purchases and recorded payments. */
export function weeklySpending(model: CalendarModel, date: ISODate): WeekDaySpending[] {
  return spendingOnDates(model, weekDates(date));
}

/** All calendar days of the displayed month, including short months and leap years. */
export function monthlySpending(model: CalendarModel, date: ISODate): WeekDaySpending[] {
  const { year, month } = dateParts(date);
  const first = monthStartOf(date);
  return spendingOnDates(model, Array.from({ length: daysInMonth(year, month) }, (_, i) => addDays(first, i)));
}

function spendingOnDates(model: CalendarModel, dates: readonly ISODate[]): WeekDaySpending[] {
  return dates.map((day) => ({
    date: day,
    spendingCents: (model.entriesByDate.get(day) ?? []).filter((e) => !isIncoming(e)).reduce((sum, e) => sum + e.amountCents, 0),
  }));
}

/** SVG user units for the weekly chart. */
export const WEEK_CHART = { width: 560, height: 230, left: 48, right: 18, top: 24, bottom: 38, gridLines: 4 } as const;

/** Top of the y axis: the week's largest day rounded up to a $50 step, at least $50. */
export function weekScaleMaxCents(days: readonly WeekDaySpending[]): Cents {
  const step = 5000;
  const max = Math.max(step, ...days.map((d) => d.spendingCents));
  return Math.ceil(max / step) * step;
}

export interface WeekChartPoint extends WeekDaySpending {
  x: number;
  y: number;
}

export function weekChartPoints(days: readonly WeekDaySpending[]): { points: WeekChartPoint[]; scaleMaxCents: Cents } {
  const { width, height, left, right, top, bottom } = WEEK_CHART;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const scaleMaxCents = weekScaleMaxCents(days);
  const points = days.map((day, i) => ({
    ...day,
    x: left + (plotWidth / Math.max(days.length - 1, 1)) * i,
    y: top + plotHeight * (1 - day.spendingCents / scaleMaxCents),
  }));
  return { points, scaleMaxCents };
}

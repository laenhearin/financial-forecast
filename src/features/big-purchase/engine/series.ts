import { daysBetween } from "../../../lib/dates";
import type { Cents, DayPoint, FundingPoint, ISODate, Plan } from "../types";

/**
 * One point at the as-of date plus one per paycheck date, through the affordable date
 * (or the horizon end when not affordable). Percent funded starts at 0 and ends at 100
 * when affordable; an affordable-now plan is a single point at 100.
 */
export function buildFunding(days: DayPoint[], paydays: ISODate[], plan: Plan, costCents: Cents): FundingPoint[] {
  const asOf = days[0].date;
  const point = (date: ISODate): FundingPoint => {
    const day = days[daysBetween(asOf, date)];
    return {
      date,
      earmarkCents: day.earmarkCents,
      percentFunded: Math.min(100, Math.max(0, (day.earmarkCents * 100) / costCents)),
      spendableCents: day.spendableCents,
    };
  };
  if (plan.affordableNow) return [point(asOf)];
  const end = plan.affordableDate ?? days[days.length - 1].date;
  return [point(asOf), ...paydays.filter(date => date <= end).map(point)];
}

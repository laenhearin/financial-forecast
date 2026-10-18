import { addDays, addMonths, daysBetween, formatDate, minDate } from "../dates";
import type {
  BalancePoint,
  CategorySlice,
  DateRange,
  Delta,
  FlowBucket,
  ReportTransaction,
  Totals,
} from "./types";
export const inRange = (date: string, range: DateRange) =>
  date >= range.start && date <= range.end;
export function cents(value: number): number {
  if (!Number.isSafeInteger(value))
    throw new Error("Report amount exceeds the supported cents range.");
  return value;
}
export function aggregateTotals(
  rows: readonly ReportTransaction[],
  range: DateRange,
): Totals {
  const result: Totals = {
    incomeCents: 0,
    spendingCents: 0,
    netCents: 0,
    billsPaidCents: 0,
    savingsContributedCents: 0,
  };
  for (const row of rows.filter((row) => inRange(row.date, range))) {
    if (cents(row.amountCents) < 0)
      throw new Error("Recorded amounts must be nonnegative.");
    if (row.kind === "income")
      result.incomeCents = cents(result.incomeCents + row.amountCents);
    if (row.kind === "spending") {
      result.spendingCents = cents(result.spendingCents + row.amountCents);
      if (row.billPayment)
        result.billsPaidCents = cents(result.billsPaidCents + row.amountCents);
    }
    if (row.kind === "savings")
      result.savingsContributedCents = cents(
        result.savingsContributedCents + row.amountCents,
      );
  }
  result.netCents = cents(result.incomeCents - result.spendingCents);
  return result;
}
export function delta(current: number, previous: number): Delta {
  return {
    current,
    previous,
    change: cents(current - previous),
    pct: previous === 0 ? null : (current - previous) / Math.abs(previous),
  };
}
export function categoryBreakdown(
  rows: readonly ReportTransaction[],
  range: DateRange,
): CategorySlice[] {
  const grouped = new Map<string, number>();
  for (const row of rows)
    if (
      row.kind === "spending" &&
      row.amountCents > 0 &&
      inRange(row.date, range)
    )
      grouped.set(
        row.category,
        cents((grouped.get(row.category) ?? 0) + row.amountCents),
      );
  const sorted = [...grouped].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const slices = sorted
    .slice(0, 6)
    .map(([category, amountCents]) => ({
      category,
      amountCents,
      pctOfTotal: 0,
    }));
  if (sorted.length > 6) {
    const remainder = sorted
      .slice(6)
      .reduce((sum, [, amount]) => cents(sum + amount), 0);
    const other = slices.find(
      (slice) => slice.category.toLowerCase() === "other",
    );
    if (other) other.amountCents = cents(other.amountCents + remainder);
    else
      slices.push({ category: "Other", amountCents: remainder, pctOfTotal: 0 });
  }
  const total = slices.reduce((sum, item) => cents(sum + item.amountCents), 0);
  if (total === 0) return [];
  for (const slice of slices)
    slice.pctOfTotal = Math.round((slice.amountCents / total) * 100);
  const largest = slices.reduce(
    (best, slice) => (slice.amountCents > best.amountCents ? slice : best),
    slices[0],
  );
  largest.pctOfTotal +=
    100 - slices.reduce((sum, item) => sum + item.pctOfTotal, 0);
  return slices;
}
export function flowBuckets(
  rows: readonly ReportTransaction[],
  range: DateRange,
): FlowBucket[] {
  const weekly = daysBetween(range.start, range.end) + 1 <= 35;
  const crossYear = range.start.slice(0, 4) !== range.end.slice(0, 4);
  const result: FlowBucket[] = [];
  for (let start = range.start; start <= range.end;) {
    const next = weekly
      ? addDays(start, 7)
      : addMonths(`${start.slice(0, 7)}-01`, 1);
    const end = minDate(addDays(next, -1), range.end);
    const totals = aggregateTotals(rows, { start, end });
    result.push({
      start,
      end,
      label:
        weekly || start.slice(8) !== "01"
          ? `${formatDate(start, "short")}${crossYear ? ` ${start.slice(0, 4)}` : ""}`
          : new Intl.DateTimeFormat("en-US", {
              month: "short",
              ...(crossYear ? { year: "numeric" as const } : {}),
              timeZone: "UTC",
            }).format(new Date(`${start}T12:00:00Z`)),
      incomeCents: totals.incomeCents,
      expensesCents: totals.spendingCents,
    });
    start = next;
  }
  return result;
}
export function downsample(
  points: BalancePoint[],
  limit = 120,
): BalancePoint[] {
  if (points.length <= limit) return points;
  let min = 0,
    max = 0;
  points.forEach((p, i) => {
    if (p.balanceCents < points[min].balanceCents) min = i;
    if (p.balanceCents > points[max].balanceCents) max = i;
  });
  const keep = new Set([0, points.length - 1, min, max]);
  // Preserve the actual/forecast join as well as extrema.
  points.forEach((p, i) => {
    if (i && p.isForecast !== points[i - 1].isForecast) {
      keep.add(i - 1);
      keep.add(i);
    }
  });
  for (
    let i = 0;
    i < points.length;
    i += Math.ceil(points.length / (limit - 6))
  )
    keep.add(i);
  return [...keep].sort((a, b) => a - b).map((index) => points[index]);
}

import { addDays, minDate } from "../dates";
import {
  historicalBalances,
  type RecordedActivity,
} from "../historical-balances";
import {
  aggregateTotals,
  categoryBreakdown,
  delta,
  downsample,
  flowBuckets,
  inRange,
} from "./aggregations";
import {
  forecastWindow,
  getPreviousRange,
  rangeLabel,
  reportTitle,
  validateRange,
} from "./dateRange";
import { buildFallbackSummary } from "./fallbackSummary";
import { maskAccountNumber, safeLabel } from "./masking";
import { includedSections } from "./sections";
import type {
  BalancePoint,
  ReportConfig,
  ReportData,
  ReportTransaction,
  Totals,
} from "./types";

/** Adapter input contains private identifiers; the explicit output projection never does. */
export interface ReportInput {
  config: ReportConfig;
  today: string;
  customerName: string;
  sourceLabel: string;
  bufferCents: number;
  transactions: ReportTransaction[];
  history: RecordedActivity[];
  snapshotCents: number;
  forecast: BalancePoint[];
}
export function buildReportData(input: ReportInput): ReportData {
  const { config, today } = input;
  const validation = validateRange(config.range);
  if (!validation.valid) throw new Error(validation.error);
  const included = includedSections(config, today);
  if (!included.length) throw new Error("Select at least one section.");
  const has = (id: ReportData["includedSections"][number]) =>
    included.includes(id);
  const identifiers = [
    ...new Set(
      input.transactions.flatMap((row) =>
        row.accountNumber ? [row.accountNumber] : [],
      ),
    ),
  ];
  const protect = (value: string) =>
    safeLabel(
      identifiers.reduce(
        (text, number) => text.split(number).join(maskAccountNumber(number)),
        value,
      ),
    );
  const transactions = input.transactions
    .filter((row) => row.date <= today)
    .map((row) => ({
      date: row.date,
      label: protect(row.label),
      category: protect(row.category),
      accountLabel: `${protect(row.accountLabel)} ${maskAccountNumber(row.accountNumber ?? "")}`,
      amountCents: row.amountCents,
      kind: row.kind,
      direction: row.direction,
      billPayment: row.billPayment,
    }));
  const previousRange = getPreviousRange(config.range, config.preset);
  const totals = aggregateTotals(transactions, config.range);
  const previous = aggregateTotals(transactions, previousRange);
  const categories = categoryBreakdown(transactions, config.range);
  const earliest = minDate(
    minDate(previousRange.start, config.range.start),
    today,
  );
  // A zero event extends the existing reconstruction to the requested start, without fabricating activity.
  const history = historicalBalances(
    [
      ...input.history.filter((row) => row.date >= earliest),
      {
        id: "range-boundary",
        date: earliest,
        kind: "deposit",
        amountCents: 0,
        label: "",
      },
    ],
    today,
    input.snapshotCents,
  );
  const balances: BalancePoint[] = history.map((row) => ({
    date: addDays(today, row.day),
    balanceCents: row.balanceCents,
    isForecast: false,
  }));
  balances.push(
    { date: today, balanceCents: input.snapshotCents, isForecast: false },
    ...input.forecast.filter((p) => p.date > today),
  );
  const ending = (end: string) =>
    balances.find((point) => point.date === end)?.balanceCents;
  const end = ending(config.range.end),
    prevEnd = ending(previousRange.end);
  const data: ReportData = {
    meta: {
      title: reportTitle(config.range),
      range: { ...config.range },
      today,
      customerName: protect(input.customerName),
      sourceLabel: protect(input.sourceLabel),
    },
    includedSections: included,
    compareToPrevious: config.compareToPrevious,
    bufferCents: input.bufferCents,
    forecastWindow: forecastWindow(config.range, today),
    notes: [
      "Historical balances are reconstructed estimates from available activity, not bank statements. Forecasts include scheduled bills and estimated income and spending.",
    ],
  };
  if (!transactions.some((row) => inRange(row.date, config.range)))
    data.notes.push("No recorded activity was available for this period.");
  if (config.range.end > (input.forecast.at(-1)?.date ?? today))
    data.notes.push(
      "Balance projection stops at the app's forecast horizon; later balances are unavailable.",
    );
  if (has("overview")) {
    data.keyNumbers = {
      ...(Object.fromEntries(
        (Object.keys(totals) as (keyof Totals)[]).map((key) => [
          key,
          delta(totals[key], previous[key]),
        ]),
      ) as Record<keyof Totals, ReturnType<typeof delta>>),
      endingBalanceCents: end === undefined ? null : delta(end, prevEnd ?? 0),
    };
    data.summaryStats = {
      rangeLabel: rangeLabel(config.range),
      totals: {
        incomeCents: totals.incomeCents,
        spendingCents: totals.spendingCents,
        netCents: totals.netCents,
      },
      ...(config.compareToPrevious
        ? {
            previous: {
              incomeCents: previous.incomeCents,
              spendingCents: previous.spendingCents,
              netCents: previous.netCents,
            },
          }
        : {}),
      topCategories: categories
        .slice(0, 5)
        .map(({ category, amountCents }) => ({ category, amountCents })),
    };
    data.summary = {
      text: buildFallbackSummary(data.summaryStats),
      source: "fallback",
    };
  }
  if (has("chartBalance"))
    data.balanceSeries = downsample(
      balances.filter((point) => inRange(point.date, config.range)),
    );
  if (has("chartCategory")) data.categoryBreakdown = categories;
  if (has("chartIncomeExpense"))
    data.flowBuckets = flowBuckets(transactions, config.range);
  if (has("transactions")) {
    const rows = transactions
      .filter((row) => inRange(row.date, config.range))
      .sort((a, b) => a.date.localeCompare(b.date));
    data.transactions = {
      rows: rows.slice(0, 1000),
      totalCount: rows.length,
      truncated: rows.length > 1000,
    };
  }
  return data;
}

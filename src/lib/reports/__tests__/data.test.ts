import { describe, expect, it } from "vitest";
import { aggregateTotals, categoryBreakdown, delta, downsample, flowBuckets } from "../aggregations";
import { buildReportData, type ReportInput } from "../buildReportData";
import { buildFallbackSummary } from "../fallbackSummary";
import { DEFAULT_SECTIONS } from "../sections";
import type { ReportTransaction } from "../types";
const range = { start: "2026-09-01", end: "2026-09-30" };
const row = (kind: ReportTransaction["kind"], amountCents: number, extra = {}): ReportTransaction => ({ date: "2026-09-05", label: "Test", category: "Other", accountLabel: "Checking", kind, amountCents, ...extra });
export const fixture = (): ReportInput => ({
  config: { range, preset: "last-month", sections: { ...DEFAULT_SECTIONS }, compareToPrevious: true }, today: "2026-10-17", customerName: "Test", sourceLabel: "Test fixture", bufferCents: 10000,
  snapshotCents: 50000, history: [], forecast: [], transactions: [row("income", 10000), row("spending", 3000)],
});
describe("report aggregates", () => {
  it("separates savings and internal transfers from actual income/spend", () => {
    expect(aggregateTotals([row("income", 10000), row("spending", 3000, { billPayment: true }), row("internal-transfer", 8000), row("savings", 2000)], range)).toEqual({ incomeCents: 10000, spendingCents: 3000, netCents: 7000, billsPaidCents: 3000, savingsContributedCents: 2000 });
    expect(delta(3000, 0).pct).toBeNull(); expect(delta(500, -1000).pct).toBe(1.5);
  });
  it("merges the category tail and corrects rounding drift", () => {
    const slices = categoryBreakdown(Array.from({ length: 10 }, (_, i) => row("spending", 100 + i, { category: `Category ${i}` })), range);
    expect(slices).toHaveLength(7); expect(slices.at(-1)?.category).toBe("Other");
    expect(slices.reduce((sum, item) => sum + item.pctOfTotal, 0)).toBe(100);
    expect(categoryBreakdown([row("income", 100), row("spending", 0)], range)).toEqual([]);
  });
  it("uses weekly <=35 days, then monthly with partial/cross-year labels", () => {
    expect(flowBuckets([], { start: "2026-09-01", end: "2026-10-05" })).toHaveLength(5);
    expect(flowBuckets([], { start: "2026-09-01", end: "2026-10-06" })).toHaveLength(2);
    const buckets = flowBuckets([], { start: "2025-12-15", end: "2026-02-02" });
    expect(buckets[0].label).toBe("Dec 15 2025"); expect(buckets[1].label).toBe("Jan 2026"); expect(buckets[2].end).toBe("2026-02-02");
  });
  it("retains extrema and endpoints when downsampling", () => {
    const points = Array.from({ length: 366 }, (_, i) => ({ date: String(i), balanceCents: i === 129 ? -10000 : i, isForecast: i > 200 }));
    const sampled = downsample(points); expect(sampled.length).toBeLessThanOrEqual(120); expect(sampled).toContain(points[129]); expect(sampled).toContain(points[365]); expect(sampled).toContain(points[200]);
  });
});
it("projects only requested fields, masks free text, and caps a stable date sort", () => {
  const input = fixture(); input.config.sections = { ...Object.fromEntries(Object.keys(DEFAULT_SECTIONS).map(key => [key, false])), transactions: true } as typeof DEFAULT_SECTIONS;
  input.transactions = Array.from({ length: 1002 }, (_, i) => row("spending", i, { label: `Item ${i} account 1234567890`, accountNumber: "1234567890", accountLabel: "Checking 1234567890", date: i === 0 ? "2026-09-06" : "2026-09-05" }));
  const data = buildReportData(input);
  expect(data.keyNumbers).toBeUndefined(); expect(data.balanceSeries).toBeUndefined(); expect(data.transactions?.rows).toHaveLength(1000);
  expect(data.transactions?.rows[0].label).toBe("Item 1 account ****7890"); expect(data.transactions?.truncated).toBe(true);
  expect(JSON.stringify(data)).not.toContain("1234567890"); expect(JSON.stringify(data)).not.toContain("accountNumber");
});
it("reconstructs historical balances without replaying today's activity", () => {
  const input = fixture(); input.today = "2026-09-30"; input.history = [{ id: "d", date: "2026-09-30", kind: "deposit", amountCents: 10000, label: "Income" }];
  const data = buildReportData(input);
  expect(data.balanceSeries?.find(p => p.date === "2026-09-29")?.balanceCents).toBe(40000);
  expect(data.keyNumbers?.endingBalanceCents?.current).toBe(50000);
});
it("fallback handles empty spending, negative net, comparison and forecast", () => {
  const input = fixture(); const normal = buildReportData(input).summary!;
  expect(normal.source).toBe("fallback"); expect(normal.text).toContain("$100"); expect(normal.text).toContain("previous period");
  expect(buildFallbackSummary({ rangeLabel: "Test", totals: { incomeCents: 0, spendingCents: 0, netCents: 0 }, topCategories: [] })).toContain("no recorded spending");
  const negative = buildFallbackSummary({ rangeLabel: "Test", totals: { incomeCents: 0, spendingCents: 1000, netCents: -1000 }, topCategories: [], forecast: { lowestBalanceCents: -500, lowestBalanceDate: "2026-10-20", worstWeather: "Critical", stormDays: 2 } });
  expect(negative).toContain("exceeded income by $10"); expect(negative).toContain("-$5"); expect(negative).not.toContain("previous");
});

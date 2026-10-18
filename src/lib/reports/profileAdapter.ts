import type { CustomerProfile } from "../nessie-profile";
import { buildCalendarModel } from "@/features/calendar/engine/model";
import { ALL_ACCOUNTS } from "@/features/calendar/types";
import { categorizeByKeyword } from "@/features/cash-back/engine/categorize";
import { buildReportData } from "./buildReportData";
import { computeForecast } from "@/features/big-purchase/engine/forecast";
import type { Goal } from "@/features/big-purchase/types";
import { balanceLevel, BALANCE_LABELS } from "@/features/calendar/engine/balanceThresholds";
import { inRange } from "./aggregations";
import { buildFallbackSummary } from "./fallbackSummary";
import { safeLabel } from "./masking";
import type { ReportConfig } from "./types";

/** No new Nessie requests: use the same server-normalized profile as the other pages. */
export function reportFromProfile(profile: CustomerProfile, config: ReportConfig, criticalCents: number, goals: readonly Goal[] = []) {
  const { scenario } = profile;
  const model = buildCalendarModel(scenario, [], ALL_ACCOUNTS);
  const names = new Map(scenario.accounts.map(account => [account.id, account.nickname]));
  const history = profile.history.filter(row => names.has(row.accountId));
  const data = buildReportData({
    config, today: profile.asOfDate, customerName: profile.customer.name, sourceLabel: profile.sourceLabel,
    bufferCents: criticalCents, snapshotCents: model.startingCents, history,
    transactions: history.map(row => ({ date: row.date, label: row.label, category: row.kind === "deposit" ? "Income" : (categorizeByKeyword(row.label) ?? "Uncategorized").replaceAll("_", " "), accountLabel: names.get(row.accountId) ?? "Account", amountCents: row.amountCents, kind: row.kind === "deposit" ? "income" : "spending" })),
    forecast: [...model.balances].map(([date, balance]) => ({ date, balanceCents: balance.totalCents, isForecast: date > profile.asOfDate })),
  });
  data.notes.push("Recorded activity is completed deposits and withdrawals. Categories are keyword estimates. Transfers, matched bill payments and savings contributions are not provided by the current feed; zero means none identified, not confirmed absent.");
  if (data.includedSections.includes("billsPaychecks")) {
    data.bills = model.entries.filter(row => row.kind === "bill" && inRange(row.date, config.range)).map(row => ({ date: row.date, name: safeLabel(row.label), amountCents: row.amountCents, status: "upcoming" }));
    data.paychecks = [
      ...history.filter(row => row.kind === "deposit" && inRange(row.date, config.range)).map(row => ({ date: row.date, name: safeLabel(row.label), amountCents: row.amountCents, status: "received" as const })),
      ...model.entries.filter(row => row.kind === "income" && inRange(row.date, config.range)).map(row => ({ date: row.date, name: safeLabel(row.label), amountCents: row.amountCents, status: "expected" as const })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }
  if (data.forecastWindow) {
    const weather = [...model.balances].filter(([date]) => inRange(date, data.forecastWindow!)).map(([date, balance]) => {
      const level = balanceLevel(balance.totalCents, criticalCents);
      return { date, level, label: BALANCE_LABELS[level], endBalanceCents: balance.totalCents };
    });
    if (data.includedSections.includes("forecastCalendar")) data.weatherDays = weather;
    if (data.summaryStats && weather.length) {
      const low = weather.reduce((a, b) => a.endBalanceCents <= b.endBalanceCents ? a : b);
      data.summaryStats.forecast = { lowestBalanceCents: low.endBalanceCents, lowestBalanceDate: low.date, worstWeather: low.label, stormDays: weather.filter(d => d.level >= 4).length };
      data.summary = { text: buildFallbackSummary(data.summaryStats), source: "fallback" };
    }
  }
  if (data.includedSections.includes("chartGoals")) {
    data.goals = config.range.end < profile.asOfDate ? [] : goals.map(goal => {
      const forecast = computeForecast(scenario, goal);
      return { name: safeLabel(goal.name), targetCents: goal.costCents, savedCents: null, pct: null, asOfDate: profile.asOfDate, ...(forecast.ok && forecast.forecast.plan.affordableDate ? { estimatedCompletion: forecast.forecast.plan.affordableDate } : {}) };
    });
  }
  return data;
}

import { addDays } from "../../../lib/dates";
import { formatUSD } from "../../../lib/money";
import type { Scenario } from "../../big-purchase/types";
import { FORECAST_DAYS } from "../config";
import { ALL_ACCOUNTS, type AccountView, type CalendarEntry, type Cents, type DayBalance, type ISODate, type UserPurchase } from "../types";
import { forecastEndDate, purchaseEntry, scenarioEntries, signedCents, sortEntries } from "./entries";

export interface CalendarModel {
  asOfDate: ISODate;
  forecastEnd: ISODate;
  accountIds: string[];
  /** Starting balances of the accounts in view; the baseline for risk shading. */
  startingCents: Cents;
  entries: CalendarEntry[];
  entriesByDate: Map<ISODate, CalendarEntry[]>;
  /** End-of-day balances from the as-of date through the forecast end. */
  balances: Map<ISODate, DayBalance>;
}

export function viewAccountIds(scenario: Scenario, view: AccountView): string[] {
  if (view === ALL_ACCOUNTS) return scenario.accounts.map((account) => account.id);
  return scenario.accounts.some((account) => account.id === view) ? [view] : [];
}

/**
 * Entries and daily balances for the accounts in view. Account balances are end of day on the
 * as-of date, so scheduled items start the next day. Purchases added here count from the as-of
 * date onward; earlier ones are listed but do not change the forecast.
 */
export function buildCalendarModel(
  scenario: Scenario,
  purchases: readonly UserPurchase[],
  view: AccountView,
  baseEntries: readonly CalendarEntry[] = scenarioEntries(scenario),
): CalendarModel {
  const asOfDate = scenario.asOfDate;
  const forecastEnd = forecastEndDate(asOfDate);
  const accountIds = viewAccountIds(scenario, view);
  const inView = new Set(accountIds);

  const entries = sortEntries([...baseEntries, ...purchases.map(purchaseEntry)].filter((entry) => inView.has(entry.accountId)));
  const entriesByDate = new Map<ISODate, CalendarEntry[]>();
  for (const entry of entries) entriesByDate.set(entry.date, [...(entriesByDate.get(entry.date) ?? []), entry]);

  const running: Record<string, Cents> = {};
  for (const account of scenario.accounts) if (inView.has(account.id)) running[account.id] = account.balanceCents;
  const startingCents = Object.values(running).reduce((sum, cents) => sum + cents, 0);

  const balances = new Map<ISODate, DayBalance>();
  for (let date = asOfDate; date <= forecastEnd; date = addDays(date, 1)) {
    for (const entry of entriesByDate.get(date) ?? []) running[entry.accountId] += signedCents(entry);
    const totalCents = Object.values(running).reduce((sum, cents) => sum + cents, 0);
    if (!Number.isSafeInteger(totalCents)) throw new Error("Projected balance exceeds the supported range.");
    balances.set(date, { totalCents, byAccount: { ...running } });
  }

  return { asOfDate, forecastEnd, accountIds, startingCents, entries, entriesByDate, balances };
}

/** Projected total for a day, or null before the as-of date and after the forecast window. */
export function balanceOn(model: CalendarModel, date: ISODate): Cents | null {
  return model.balances.get(date)?.totalCents ?? null;
}

export type RiskLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const RISK_LABELS: Record<RiskLevel, string> = {
  0: "Comfortable",
  1: "Rain / warning",
  2: "Low",
  3: "Risky",
  4: "Critical",
  5: "Below $0",
};

/** Shading level from the balance as a share of the starting balance (75%, 50%, 25%, 10%, below $0). */
export function riskLevel(balanceCents: Cents | null, baselineCents: Cents): RiskLevel {
  if (balanceCents === null) return 0;
  const base = Math.max(baselineCents, 100);
  if (balanceCents < 0) return 5;
  if (balanceCents * 100 <= base * 10) return 4;
  if (balanceCents * 100 <= base * 25) return 3;
  if (balanceCents * 100 <= base * 50) return 2;
  if (balanceCents * 100 <= base * 75) return 1;
  return 0;
}

export function lowestBalance(model: CalendarModel): { date: ISODate; cents: Cents } {
  let lowest = { date: model.asOfDate, cents: balanceOn(model, model.asOfDate) ?? model.startingCents };
  for (const [date, { totalCents }] of model.balances) if (totalCents < lowest.cents) lowest = { date, cents: totalCents };
  return lowest;
}

export function upcomingBills(model: CalendarModel): { count: number; totalCents: Cents } {
  const bills = model.entries.filter((e) => e.kind === "bill" && e.date >= model.asOfDate && e.date <= model.forecastEnd);
  return { count: bills.length, totalCents: bills.reduce((sum, bill) => sum + bill.amountCents, 0) };
}

/** Is the balance at or below this percent of the starting balance? */
export function atOrBelowShare(balanceCents: Cents, baselineCents: Cents, percent: number): boolean {
  return balanceCents * 100 <= baselineCents * percent;
}

export interface DayAlert {
  tone: "safe" | "caution" | "danger";
  text: string;
}

/** The message at the top of the selected-day panel. */
export function dayAlert(model: CalendarModel, date: ISODate): DayAlert {
  const balance = balanceOn(model, date);
  if (balance === null) {
    return date < model.asOfDate
      ? { tone: "safe", text: "This date is in the past. Select today or a future date to see the forecast." }
      : { tone: "safe", text: `This date is past the ${FORECAST_DAYS}-day forecast window.` };
  }
  if (balance < 0) return { tone: "danger", text: `⚠️ Danger: your projected balance is ${formatUSD(-balance)} below zero.` };
  if (atOrBelowShare(balance, model.startingCents, 25)) {
    return { tone: "caution", text: `⚠️ Low balance: you may have only ${formatUSD(balance)} left after this day's transactions. Review upcoming spending.` };
  }
  if (atOrBelowShare(balance, model.startingCents, 50)) {
    return { tone: "caution", text: `Heads up: your projected balance is ${formatUSD(balance)}. Keep an eye on upcoming bills.` };
  }
  return { tone: "safe", text: `✓ Your projected balance is ${formatUSD(balance)} after this day's transactions.` };
}

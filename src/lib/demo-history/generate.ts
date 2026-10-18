import { addDays, addMonths, clampedDate, dateParts, dayOfWeek, daysBetween, daysInMonth } from "../dates";
import { billCategory, classifyTransaction, seedDescription, type SpendingCategoryId, type TransactionTag } from "../spending-categories";
import type { PersonaHistory, SpendRule } from "./personas";

/**
 * Builds the six-month Nessie history (seed v2) for one seeded persona. Pure and deterministic: the
 * same plan and persona always give the same records, so the seed script can find what is missing by
 * description. Every amount is whole dollars (Nessie amounts are integers), stored here in cents.
 */

export const HISTORY_SEED_ID = "ff-demo-v2";
export const HISTORY_MONTHS = 6;

export interface PlanProfileInput {
  slug: string;
  checkingCents: number;
  savingsCents: number;
  income: { amountCents: number; frequency: string; anchorDate: string };
  bills: { label: string; payee: string; amountCents: number; recurringDay: number; category?: string }[];
  estimatedMonthlySpendingCents: number;
  /** Seed v1 records already in Nessie, all on checking. */
  transactions: { key: string; kind: "deposit" | "withdrawal"; date: string; amountCents: number; label: string }[];
}

export type HistoryAccount = "checking" | "savings";

export interface HistoryRecord {
  seq: number;
  account: HistoryAccount;
  kind: "deposit" | "withdrawal";
  date: string;
  amountCents: number;
  label: string;
  tag: TransactionTag;
  description: string;
}

export interface PersonaHistoryResult {
  slug: string;
  records: HistoryRecord[];
  /** Reconstructed from today's snapshots by undoing every record, v1 included, as the home page does. */
  startCheckingCents: number;
  startSavingsCents: number;
  lowestCheckingCents: number;
}

/** First day of the history window: six months before asOfDate, plus one day (2026-04-18 for 2026-10-17). */
export function historyWindowStart(asOfDate: string): string {
  return addDays(addMonths(asOfDate, -HISTORY_MONTHS), 1);
}

type Draft = Omit<HistoryRecord, "seq" | "description">;

export function generatePersonaHistory(plan: PlanProfileInput, persona: PersonaHistory, asOfDate: string): PersonaHistoryResult {
  if (plan.slug !== persona.slug) throw new Error(`Persona ${persona.slug} does not match plan ${plan.slug}.`);
  const budget = persona.spend.reduce((sum, rule) => sum + rule.monthlyCents, 0);
  if (budget !== plan.estimatedMonthlySpendingCents) {
    throw new Error(`${persona.slug}: spending budgets add up to ${budget} cents, not the plan's ${plan.estimatedMonthlySpendingCents}.`);
  }
  const start = historyWindowStart(asOfDate);
  const days = Array.from({ length: daysBetween(start, asOfDate) + 1 }, (_, index) => addDays(start, index));
  const random = mulberry32(hash(persona.slug));
  const drafts: Draft[] = [];
  const add = (account: HistoryAccount, kind: Draft["kind"], date: string, amountCents: number, label: string, tag: TransactionTag) => {
    if (date < start || date > asOfDate) return;
    wholeDollars(amountCents, `${persona.slug} ${label}`);
    if (amountCents <= 0) throw new Error(`${persona.slug} ${label}: amounts must be positive.`);
    drafts.push({ account, kind, date, amountCents, label, tag });
  };

  // v1 records count toward the same totals; they are already in Nessie and are not written again.
  const v1 = plan.transactions.filter(row => row.date >= start && row.date <= asOfDate);
  const v1Spend = new Map<SpendingCategoryId, number>();
  for (const row of v1) {
    const { flow, category } = classifyTransaction(row.kind, "", row.label);
    if (flow === "spend" && category) v1Spend.set(category, (v1Spend.get(category) ?? 0) + row.amountCents);
  }

  // Paychecks on the plan schedule, skipping the one a v1 deposit already covers.
  const v1Deposits = v1.filter(row => row.kind === "deposit").map(row => row.date);
  const paydays = scheduleDates(plan.income, start, asOfDate)
    .filter(date => !v1Deposits.some(deposit => Math.abs(daysBetween(deposit, date)) <= 7));
  for (const date of paydays) {
    const swing = persona.paycheckVariation * (2 * random() - 1);
    add("checking", "deposit", date, roundDollars(plan.income.amountCents * (1 + swing)), persona.paycheckLabel, "income");
  }

  // Past payments of each scheduled Nessie bill; utilities run higher in the Florida summer.
  for (const bill of plan.bills) {
    const category = bill.category ?? billCategory(bill.label);
    const seasonal = /utilit/i.test(bill.label);
    for (const date of monthlyDates(bill.recurringDay, start, asOfDate)) {
      const factor = seasonal ? UTILITY_SEASON[dateParts(date).month] : 1;
      add("checking", "withdrawal", date, roundDollars(bill.amountCents * factor), `${bill.label} payment`, `bill:${category}`);
    }
  }

  for (const rule of persona.spend) {
    const tag: TransactionTag = `spend:${rule.category}`;
    if (rule.fixed) {
      const fixedTotal = rule.fixed.reduce((sum, item) => sum + item.cents, 0);
      if (fixedTotal !== rule.monthlyCents) throw new Error(`${persona.slug} ${rule.category}: fixed charges must add up to the budget.`);
      for (const item of rule.fixed) for (const date of monthlyDates(item.day, start, asOfDate)) add("checking", "withdrawal", date, item.cents, item.label, tag);
      continue;
    }
    const total = rule.monthlyCents * HISTORY_MONTHS - (v1Spend.get(rule.category) ?? 0);
    if (total < 0) throw new Error(`${persona.slug} ${rule.category}: v1 records already exceed six months of budget.`);
    for (const purchase of purchases(rule, total, days, random)) add("checking", "withdrawal", purchase.date, purchase.cents, purchase.label, tag);
  }

  for (const item of persona.oneOffs) add("checking", "withdrawal", item.date, item.cents, item.label, `oneoff:${item.category}`);
  for (const item of persona.contributions ?? []) {
    for (const date of monthlyDates(item.day, start, asOfDate)) add("checking", "withdrawal", date, item.cents, item.label, "saving");
  }
  if (persona.savingsTransfer) {
    for (const date of monthlyDates(persona.savingsTransfer.day, start, asOfDate)) {
      add("checking", "withdrawal", date, persona.savingsTransfer.cents, "Transfer to savings", "transfer");
      add("savings", "deposit", date, persona.savingsTransfer.cents, "Transfer from checking", "transfer");
    }
  }
  if (persona.savingsInterestCents) {
    for (const date of monthEnds(start, asOfDate)) add("savings", "deposit", date, persona.savingsInterestCents, "Savings interest", "interest");
  }

  // Sweep the remaining surplus once a month, the day after the month's first payday, so checking
  // starts the window near today's balance and never dips below the persona's floor.
  const checkingFlows = new Map<string, number>();
  const flow = (date: string, cents: number) => checkingFlows.set(date, (checkingFlows.get(date) ?? 0) + cents);
  for (const row of v1) flow(row.date, row.kind === "deposit" ? row.amountCents : -row.amountCents);
  for (const row of drafts) if (row.account === "checking") flow(row.date, row.kind === "deposit" ? row.amountCents : -row.amountCents);
  const path: number[] = [];
  let running = persona.startCheckingCents ?? plan.checkingCents;
  for (const day of days) path.push(running += checkingFlows.get(day) ?? 0);
  const surplus = path[path.length - 1] - plan.checkingCents;
  if (surplus < 0) throw new Error(`${persona.slug}: outgoings exceed income by ${-surplus} cents; reduce one-offs or contributions.`);
  const sweepDays = sweepDates([...paydays, ...v1Deposits].sort(), asOfDate);
  // Most that can still leave on a date: the lowest later balance (after earlier sweeps) above the floor.
  const room = (date: string) => Math.min(...path.slice(daysBetween(start, date))) - persona.floorCents;
  let swept = 0;
  for (const [index, date] of sweepDays.entries()) {
    const last = index === sweepDays.length - 1;
    const goal = last ? surplus : Math.floor((surplus * (index + 1)) / sweepDays.length / 1_000) * 1_000;
    const target = Math.max(swept, Math.min(goal, swept + Math.floor(room(date) / 100) * 100));
    if (target > swept) {
      const sweepTag: TransactionTag = persona.sweep.tag === "saving" ? "saving" : `oneoff:${persona.sweep.category ?? "other"}`;
      add("checking", "withdrawal", date, target - swept, persona.sweep.label, sweepTag);
      for (let day = daysBetween(start, date); day < path.length; day++) path[day] -= target - swept;
      swept = target;
    }
  }

  drafts.sort((a, b) => a.date.localeCompare(b.date) || a.account.localeCompare(b.account) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label));
  const records = drafts.map((row, index) => ({ ...row, seq: index + 1, description: seedDescription(HISTORY_SEED_ID, persona.slug, index + 1, row.tag, row.label) }));

  // Undo every record from today's snapshots, as the home page's balance history does.
  const signed = (row: { kind: string; amountCents: number }) => (row.kind === "deposit" ? row.amountCents : -row.amountCents);
  const byDay = new Map<string, number>();
  for (const row of [...v1, ...records.filter(item => item.account === "checking")]) byDay.set(row.date, (byDay.get(row.date) ?? 0) + signed(row));
  const startCheckingCents = plan.checkingCents - [...byDay.values()].reduce((sum, cents) => sum + cents, 0);
  let balance = startCheckingCents;
  let lowest = startCheckingCents;
  for (const day of days) lowest = Math.min(lowest, balance += byDay.get(day) ?? 0);
  const savingsNet = records.filter(row => row.account === "savings").reduce((sum, row) => sum + signed(row), 0);
  return { slug: persona.slug, records, startCheckingCents, startSavingsCents: plan.savingsCents - savingsNet, lowestCheckingCents: lowest };
}

/** Florida-style seasonal multiplier for the utilities bill, by month. */
const UTILITY_SEASON: Record<number, number> = { 1: 0.9, 2: 0.85, 3: 0.85, 4: 0.9, 5: 1, 6: 1.15, 7: 1.25, 8: 1.25, 9: 1.1, 10: 0.95, 11: 0.85, 12: 0.9 };

/** Spreads a rule's total over its purchases: one per equal slice of the allowed days, amounts varied but adding up exactly. */
function purchases(rule: SpendRule, totalCents: number, days: readonly string[], random: () => number) {
  if (totalCents === 0) return [];
  const allowed = rule.season ? days.filter(day => rule.season!.some(({ from, to }) => day.slice(5) >= from && day.slice(5) <= to)) : days;
  const count = Math.max(1, Math.min(Math.round(rule.perMonth * HISTORY_MONTHS), Math.floor(totalCents / 100), allowed.length));
  const slice = allowed.length / count;
  const dates = Array.from({ length: count }, (_, index) => {
    const from = Math.floor(index * slice);
    const to = Math.max(from, Math.floor((index + 1) * slice) - 1);
    let pick = from + Math.floor(random() * (to - from + 1));
    if (rule.weekend && random() < 0.7) {
      const weekend = allowed.slice(from, to + 1).map((day, offset) => ({ day, offset })).filter(({ day }) => [0, 5, 6].includes(dayOfWeek(day)));
      if (weekend.length) pick = from + weekend[Math.floor(random() * weekend.length)].offset;
    }
    return allowed[pick];
  });
  const weights = dates.map(() => 0.55 + 0.9 * random());
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const amounts = weights.map(weight => Math.max(100, roundDollars((totalCents * weight) / sum)));
  // Put the rounding difference on the largest purchase so the total is exact.
  const largest = amounts.indexOf(Math.max(...amounts));
  amounts[largest] += totalCents - amounts.reduce((total, cents) => total + cents, 0);
  if (amounts[largest] < 100) throw new Error(`${rule.category}: budget too small for ${count} purchases.`);
  return dates.map((date, index) => ({ date, cents: amounts[index], label: rule.merchants[Math.floor(random() * rule.merchants.length)] }));
}

/** Paydays inside the window, stepping back from the plan's anchor date. */
function scheduleDates(income: PlanProfileInput["income"], start: string, end: string): string[] {
  if (income.frequency === "monthly") return monthlyDates(Number(income.anchorDate.slice(8, 10)), start, end);
  if (income.frequency !== "biweekly") throw new Error(`Unsupported income frequency ${income.frequency}.`);
  const dates: string[] = [];
  for (let date = income.anchorDate; date >= start; date = addDays(date, -14)) if (date <= end) dates.push(date);
  return dates.reverse();
}

/** The given day of every month in the window (clamped to short months). */
function monthlyDates(day: number, start: string, end: string): string[] {
  const dates: string[] = [];
  let { year, month } = dateParts(start);
  for (;;) {
    const date = clampedDate(year, month, day);
    if (date > end) break;
    if (date >= start) dates.push(date);
    if (++month > 12) { month = 1; year++; }
  }
  return dates;
}

function monthEnds(start: string, end: string): string[] {
  return monthlyDates(31, start, end).filter(date => dateParts(date).day === daysInMonth(dateParts(date).year, dateParts(date).month));
}

/**
 * The day after the first payday of each month, plus the day after the latest payday: a low balance
 * just after a payday (today's snapshot for the tight personas) means money left right after it.
 */
function sweepDates(paydays: readonly string[], end: string): string[] {
  const firstByMonth = new Map<string, string>();
  for (const date of paydays) if (!firstByMonth.has(date.slice(0, 7))) firstByMonth.set(date.slice(0, 7), date);
  const latest = paydays[paydays.length - 1];
  const dates = new Set([...firstByMonth.values(), ...(latest ? [latest] : [])].map(date => addDays(date, 1)));
  return [...dates].filter(date => date <= end).sort();
}

function roundDollars(cents: number): number {
  return Math.round(cents / 100) * 100;
}

function wholeDollars(cents: number, label: string): void {
  if (!Number.isSafeInteger(cents) || cents % 100 !== 0) throw new Error(`${label}: Nessie amounts must be whole dollars.`);
}

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

/** Small seeded generator, so the history is the same on every run. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

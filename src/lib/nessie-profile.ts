import "server-only";
import { ScenarioLoadError } from "../data/dataSource";
import { validateScenario } from "../data/validateScenario";
import type { AccountSnapshot, Bill, IncomeSource, Scenario, SpendingCategory, SpendingCoverage } from "../features/big-purchase/types";
import { resolveCardId } from "../features/cash-back/cards/catalog";
import type { CashBackProfile } from "../features/cash-back/data/source";
import type { SpendProfile } from "../features/cash-back/types";
import { addDays, addMonths, daysBetween, isISODate, maxDate } from "./dates";
import { dollarsToCents } from "./money";
import {
  getAccountBills, getAccountDeposits, getAccountLoans, getAccountWithdrawals, getCustomerAccounts, getCustomers, type NessieRecord,
} from "./nessie-api";
import { planAssumptionsFor, type PlanAssumptions } from "./plan-assumptions";
import { billCategory, classifyTransaction, SPENDING_CATEGORIES, type SpendingCategoryId, type TransactionFlow } from "./spending-categories";

export { billCategory };

/**
 * Normalizes one Nessie customer into every feature's input. Balances, bills, history, loans, and
 * cards come from the API, and monthly spending by category averages the last six months of Nessie
 * transactions. Nessie has no income schedule: seeded customers use their plan's paycheck
 * (src/lib/plan-assumptions.ts); any other customer gets an estimate from repeating deposits.
 * Both are labeled. Server only.
 *
 * Money: Nessie amounts are read as dollars and converted to integer cents once, here.
 */

export const NESSIE_SOURCE_LABEL = "Nessie sandbox";
/** Income id that marks a scenario using its plan's paycheck rather than a Nessie estimate. */
export const PLAN_INCOME_ID = "plan-income";
/** Spending averages cover the last six months, today included. */
export const SPENDING_WINDOW_MONTHS = 6;

export interface CustomerSummary { id: string; name: string }

export interface RecordedTransaction {
  id: string;
  accountId: string;
  kind: "deposit" | "withdrawal";
  date: string;
  amountCents: number;
  label: string;
  /** Spending, bill payment, transfer between own accounts, and so on (src/lib/spending-categories.ts). */
  flow: TransactionFlow;
  /** For spend and one-off records. */
  category: SpendingCategoryId | null;
}

export interface CustomerProfile {
  customer: CustomerSummary;
  /** The app's "today", decided once per request by the active-customer authority. */
  asOfDate: string;
  sourceLabel: string;
  scenario: Scenario;
  cashBack: CashBackProfile;
  /** Completed deposits and withdrawals on or before asOfDate. Balances already include them; forecasts never replay them. */
  history: RecordedTransaction[];
}

export interface RawCustomerData {
  customer: CustomerSummary;
  accounts: NessieRecord[];
  /** Deposits, withdrawals, bills, and loans, read per checking or savings account. */
  activity: { accountId: string; deposits: NessieRecord[]; withdrawals: NessieRecord[]; bills: NessieRecord[]; loans?: NessieRecord[] }[];
  /** Plan income and spending for a seeded customer; null or absent uses Nessie-history estimates. */
  assumptions?: PlanAssumptions | null;
}

type AccountKind = "checking" | "savings" | "credit-card";
const ACCOUNT_KINDS: Record<string, AccountKind> = { Checking: "checking", Savings: "savings", "Credit Card": "credit-card" };

export function customerSummary(record: NessieRecord): CustomerSummary {
  const name = `${text(record, "first_name")} ${text(record, "last_name")}`.trim();
  return { id: record._id, name: name || "Nessie customer" };
}

export async function listNessieCustomers(): Promise<CustomerSummary[]> {
  return (await getCustomers()).map(customerSummary);
}

/** Reads one customer's accounts, then each cash account's deposits, withdrawals, bills, and loans, in parallel. */
export async function loadCustomerProfile(customer: CustomerSummary, today: string): Promise<CustomerProfile> {
  const accounts = await getCustomerAccounts(customer.id);
  const cash = accounts.filter(account => accountKind(account) !== "credit-card");
  const activity = await Promise.all(cash.map(async account => {
    const [deposits, withdrawals, bills, loans] = await Promise.all([
      getAccountDeposits(account._id), getAccountWithdrawals(account._id), getAccountBills(account._id), getAccountLoans(account._id),
    ]);
    return { accountId: account._id, deposits, withdrawals, bills, loans };
  }));
  return buildCustomerProfile({ customer, accounts, activity, assumptions: planAssumptionsFor(accounts) }, today);
}

/** Pure: raw Nessie records in, normalized profile out. Throws on records that do not match the observed schema. */
export function buildCustomerProfile(raw: RawCustomerData, today: string): CustomerProfile {
  if (!isISODate(today)) throw new Error(`Expected a YYYY-MM-DD date for today, got "${today}".`);
  const { customer } = raw;

  const accounts: AccountSnapshot[] = [];
  const cardIds = new Set<string>();
  for (const account of raw.accounts) {
    const kind = accountKind(account);
    if (kind === "credit-card") {
      const cardId = cardIdFromNickname(text(account, "nickname"));
      if (cardId) cardIds.add(cardId);
      continue;
    }
    accounts.push({
      id: account._id,
      nickname: displayLabel(text(account, "nickname")) || (kind === "checking" ? "Checking" : "Savings"),
      type: kind,
      balanceCents: cents(account, "balance", { allowNegative: true }),
      includeInForecast: true,
    });
  }

  const history: RecordedTransaction[] = [];
  const bills: Bill[] = [];
  const debts: NonNullable<Scenario["debts"]> = [];
  for (const { accountId, deposits, withdrawals, bills: billRows, loans = [] } of raw.activity) {
    for (const row of deposits) pushTransaction(history, row, "deposit", accountId, today);
    for (const row of withdrawals) pushTransaction(history, row, "withdrawal", accountId, today);
    for (const row of billRows) {
      const bill = toBill(row, today);
      if (bill) bills.push(bill);
    }
    for (const row of loans) {
      // Approved loans are outstanding debt; their payments are scheduled as Nessie bills.
      if (row.status !== "approved") continue;
      debts.push({
        id: row._id, label: displayLabel(text(row, "description")) || "Loan",
        balanceCents: cents(row, "amount"), monthlyPaymentCents: cents(row, "monthly_payment"),
      });
    }
  }
  history.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  // Checking first, so pages that default to the first account pick the everyday account.
  accounts.sort((a, b) => Number(a.type !== "checking") - Number(b.type !== "checking"));

  const plan = raw.assumptions ?? null;
  const monthlySpend = monthlySpendByCategory(history, today);
  const spending: SpendingCategory[] = [...monthlySpend].map(([category, cents]) => {
    const { label, maxCutPercent } = SPENDING_CATEGORIES[category];
    return { id: `spending-${category}`, label, monthlyAmountCents: cents, cuttable: maxCutPercent > 0, maxCutPercent };
  });
  const income: IncomeSource[] = plan
    ? [{ id: PLAN_INCOME_ID, label: `${plan.income.label} (plan)`, amountCents: plan.income.amountCents, schedule: plan.income.schedule, isPaycheck: true }]
    : estimateIncome(history, today);

  const scenario: Scenario = {
    id: `nessie/${customer.id}`,
    label: NESSIE_SOURCE_LABEL,
    customerName: customer.name,
    asOfDate: today,
    accounts,
    income,
    bills,
    spending,
    oneOffs: [],
    debts,
    spendingCoverage: spendingCoverage(history, today),
  };
  // A customer without deposits still gets a forecast; Forecast Fund reports the missing paycheck itself.
  const errors = validateScenario(scenario, { requirePaycheck: false }).filter(issue => issue.level === "error");
  if (errors.length) {
    throw new ScenarioLoadError(`Nessie data for ${customer.name} cannot be forecast.`, errors.map(issue => issue.message));
  }

  return {
    customer,
    asOfDate: today,
    sourceLabel: NESSIE_SOURCE_LABEL,
    scenario,
    cashBack: {
      customerName: customer.name,
      asOfDate: today,
      ownedCardIds: [...cardIds],
      spendProfile: cashBackSpendProfile(monthlySpend),
      sourceLabel: NESSIE_SOURCE_LABEL,
    },
    history,
  };
}

/** Cadences a repeating deposit can match, by the median days between deposits. */
const INCOME_CADENCES = [
  { frequency: "weekly", minDays: 6, maxDays: 8, perMonth: 52 / 12 },
  { frequency: "biweekly", minDays: 13, maxDays: 16, perMonth: 26 / 12 },
  { frequency: "monthly", minDays: 27, maxDays: 33, perMonth: 1 },
] as const;
/** Deposits in one series stay within this share of the series' median amount. */
const INCOME_AMOUNT_TOLERANCE = 0.25;
/** Labels that read like pay, preferred when no deposit repeats. */
const PAY_LABEL = /pay(check|roll)?\b|salary|wage|direct dep/i;
/** These inflows are not evidence of continuing pay, even if two happen a month apart. */
const ONE_TIME_INFLOW = /\b(?:refund|reimbursement|gift|bonus|lottery|windfall)\b/i;

/**
 * Income estimate from the last six months of income deposits (never transfers or interest).
 * A series is two or more deposits with the same label, amounts within 25% of their median, a
 * weekly, biweekly, or monthly cadence, and a latest deposit no more than two cadences ago; it
 * repeats at its median amount from its latest date. The largest series is the paycheck; others
 * are extra income. With no series, only a positively identified pay-like deposit repeats monthly
 * and says it comes from one deposit. Unidentified deposits and gifts/refunds never become payroll.
 * Nessie has no income schedule, so pages label every estimate.
 */
export function estimateIncome(history: readonly RecordedTransaction[], today: string = latestDate(history)): IncomeSource[] {
  const start = addDays(addMonths(today, -SPENDING_WINDOW_MONTHS), 1);
  const deposits = history
    .filter(row => row.kind === "deposit" && row.flow === "income" && row.amountCents > 0 &&
      !ONE_TIME_INFLOW.test(row.label) && row.date >= start && row.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (!deposits.length) return [];

  const groups = new Map<string, RecordedTransaction[]>();
  for (const row of deposits) {
    const key = row.label.toLowerCase().replace(/[^a-z]+/g, " ").trim();
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const series = [...groups.values()]
    .map(rows => incomeSeries(rows, today))
    .filter(found => found !== null)
    .sort((a, b) => b.monthlyCents - a.monthlyCents || a.latest.label.localeCompare(b.latest.label));
  if (series.length) {
    return series.map((found, index) => ({
      id: index === 0 ? "nessie-estimated-income" : `nessie-estimated-income-${index + 1}`,
      label: `${found.latest.label} (estimate)`,
      amountCents: found.amountCents,
      schedule: found.frequency === "monthly"
        ? { frequency: "monthly", dayOfMonth: Number(found.latest.date.slice(8, 10)) }
        : { frequency: found.frequency, anchorDate: found.latest.date },
      // Contributions follow one paycheck; a second job's deposits still count as income.
      isPaycheck: index === 0,
    }));
  }

  const best = deposits.filter(row => PAY_LABEL.test(row.label))
    .sort((a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date))[0];
  if (!best) return [];
  return [{
    id: "nessie-estimated-income",
    label: `${best.label} (estimate from one deposit)`,
    amountCents: best.amountCents,
    schedule: { frequency: "monthly", dayOfMonth: Number(best.date.slice(8, 10)) },
    isPaycheck: true,
  }];
}

function incomeSeries(rows: readonly RecordedTransaction[], today: string) {
  if (rows.length < 2) return null;
  const median = lowerMedian(rows.map(row => row.amountCents));
  const similar = rows.filter(row => Math.abs(row.amountCents - median) <= median * INCOME_AMOUNT_TOLERANCE);
  if (similar.length < 2) return null;
  const gaps = similar.slice(1).map((row, i) => daysBetween(similar[i].date, row.date));
  const gap = lowerMedian(gaps);
  const cadence = INCOME_CADENCES.find(c => gap >= c.minDays && gap <= c.maxDays);
  const latest = similar[similar.length - 1];
  if (!cadence || daysBetween(latest.date, today) > cadence.maxDays * 2) return null;
  const amountCents = lowerMedian(similar.map(row => row.amountCents));
  return { frequency: cadence.frequency, amountCents, latest, monthlyCents: amountCents * cadence.perMonth };
}

/** Middle value, or the lower of the two middle values, so integer cents stay integers. */
function lowerMedian(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function latestDate(history: readonly RecordedTransaction[]): string {
  return history.reduce((latest, row) => (row.date > latest ? row.date : latest), "0000-01-01");
}

/** Established: five or more months with about three spending records a month. Limited: two months and six records. */
export function spendingCoverage(history: readonly RecordedTransaction[], today: string): SpendingCoverage {
  const start = addDays(addMonths(today, -SPENDING_WINDOW_MONTHS), 1);
  const inWindow = history.filter(row => row.date >= start && row.date <= today);
  const spendRecords = inWindow.filter(row => row.flow === "spend" && row.category).length;
  const earliest = inWindow.reduce((first, row) => (row.date < first ? row.date : first), today);
  const months = inWindow.length ? Math.round(((daysBetween(earliest, today) + 1) * 120) / 365.25) / 10 : 0;
  const level: SpendingCoverage["level"] =
    months >= 5 && spendRecords >= 15 ? "established" : months >= 2 && spendRecords >= 6 ? "limited" : "insufficient";
  return { level, months: Math.min(months, SPENDING_WINDOW_MONTHS), spendRecords };
}

/**
 * Average monthly everyday spending per category over the last six months, largest first. One-offs,
 * bill payments, savings, and transfers are left out: bills are already scheduled, and the rest do
 * not repeat monthly. A history that starts in the window's first month covers all six months; a
 * shorter one is averaged over the months from its first record (at least one).
 */
export function monthlySpendByCategory(history: readonly RecordedTransaction[], today: string): Map<SpendingCategoryId, number> {
  const start = addDays(addMonths(today, -SPENDING_WINDOW_MONTHS), 1);
  const inWindow = history.filter(row => row.date >= start && row.date <= today);
  const rows = inWindow.filter(row => row.flow === "spend" && row.category);
  if (!rows.length) return new Map();
  const earliest = inWindow.reduce((first, row) => (row.date < first ? row.date : first), today);
  const covered = daysBetween(maxDate(start, earliest), today) + 1;
  const months = earliest <= addMonths(start, 1) ? SPENDING_WINDOW_MONTHS : Math.min(SPENDING_WINDOW_MONTHS, Math.max(1, (covered * 12) / 365.25));
  const totals = new Map<SpendingCategoryId, number>();
  for (const row of rows) totals.set(row.category!, (totals.get(row.category!) ?? 0) + row.amountCents);
  for (const total of totals.values()) if (!Number.isSafeInteger(total)) throw new Error("Spending total exceeds the supported range.");
  return new Map([...totals]
    .map(([category, total]) => [category, Math.round(total / months)] as const)
    .filter(([, cents]) => cents > 0)
    .sort((a, b) => b[1] - a[1]));
}

/** The same monthly spending, grouped by Swipe and Shine's reward categories. */
export function cashBackSpendProfile(monthly: ReadonlyMap<SpendingCategoryId, number>): SpendProfile {
  const profile: SpendProfile = {};
  for (const [category, cents] of monthly) {
    const id = SPENDING_CATEGORIES[category].cashBack;
    profile[id] = (profile[id] ?? 0) + cents;
  }
  return profile;
}

/**
 * Seed records carry an idempotency marker ("ff-demo-v1/college/Housing",
 * "ff-demo-v1/college-2 | SYNTHETIC | Publix groceries"). Shows the human part; other text is unchanged.
 */
export function displayLabel(value: string): string {
  const trimmed = value.trim();
  if (!/^ff-demo-v\d+\//.test(trimmed)) return trimmed;
  const human = (trimmed.includes(" | ") ? trimmed.slice(trimmed.lastIndexOf(" | ") + 3) : trimmed.slice(trimmed.lastIndexOf("/") + 1)).trim();
  return human.charAt(0).toUpperCase() + human.slice(1);
}

/** A credit card account's catalog card, from its nickname ("ff-demo-v1/college/everyday-1" or a catalog id). */
export function cardIdFromNickname(nickname: string): string | undefined {
  const trimmed = nickname.trim();
  return resolveCardId(trimmed.slice(trimmed.lastIndexOf("/") + 1)) ?? resolveCardId(trimmed);
}

function accountKind(account: NessieRecord): AccountKind {
  const kind = typeof account.type === "string" ? ACCOUNT_KINDS[account.type] : undefined;
  if (!kind) throw new Error(`Nessie account ${account._id} has an unexpected type.`);
  return kind;
}

/**
 * recurring: monthly on recurring_date, starting no earlier than payment_date when that is still ahead,
 * so a bill whose first payment is months away is not charged before it starts. payment_date is optional
 * in Nessie's schema; a missing or malformed one leaves the schedule unbounded, as before.
 * pending: one payment on payment_date, if still ahead. completed and cancelled bills are skipped.
 */
function toBill(row: NessieRecord, today: string): Bill | null {
  const payee = text(row, "payee");
  const label = displayLabel(text(row, "nickname")) || payee || "Bill";
  const base = {
    id: row._id, label, amountCents: cents(row, "payment_amount"),
    category: billCategory(`${label} ${payee}`), cancellable: false, shiftable: false,
  };
  switch (row.status) {
    case "recurring": {
      const day = row.recurring_date;
      if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 31) {
        throw new Error(`Nessie bill ${row._id} has an invalid recurring_date.`);
      }
      const first = row.payment_date;
      const startDate = typeof first === "string" && isISODate(first) && first > today ? first : undefined;
      return { ...base, schedule: { frequency: "monthly", dayOfMonth: day, ...(startDate ? { startDate } : {}) } };
    }
    case "pending": {
      const date = isoDate(row, "payment_date");
      return date > today ? { ...base, schedule: { frequency: "once", anchorDate: date } } : null;
    }
    case "completed":
    case "cancelled":
      return null;
    default:
      throw new Error(`Nessie bill ${row._id} has an unexpected status.`);
  }
}

/** Only completed records dated on or before today; the balance snapshot already includes them. */
function pushTransaction(history: RecordedTransaction[], row: NessieRecord, kind: RecordedTransaction["kind"], accountId: string, today: string) {
  if (row.status !== "completed") return;
  const date = isoDate(row, "transaction_date");
  if (date > today) return;
  const description = text(row, "description");
  const label = displayLabel(description) || (kind === "deposit" ? "Deposit" : "Withdrawal");
  history.push({ id: row._id, accountId, kind, date, amountCents: cents(row, "amount"), label, ...classifyTransaction(kind, description, label) });
}

function text(record: NessieRecord, field: string): string {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function cents(record: NessieRecord, field: string, { allowNegative = false } = {}): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || (!allowNegative && value < 0)) {
    throw new Error(`Nessie record ${record._id} has an invalid ${field}.`);
  }
  return dollarsToCents(value);
}

function isoDate(record: NessieRecord, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !isISODate(value)) throw new Error(`Nessie record ${record._id} has an invalid ${field}.`);
  return value;
}


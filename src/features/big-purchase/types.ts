export type ISODate = string;   // "YYYY-MM-DD", always treated as UTC
export type Cents = number;     // integer cents

export type GoalStatus = "draft" | "active";

export interface Goal {
  id: string;
  name: string;
  /** 0 means no cost entered yet. */
  costCents: Cents;
  bufferCents: Cents;
  bufferIsCustom: boolean;          // false: buffer follows the default rule as cost changes
  priority: number;                 // stored for later, hidden in the UI (1 = highest)
  status: GoalStatus;
  contributionCents: Cents | null;  // per paycheck; null means use the suggested amount
  preferredDeadline: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type Frequency =
  | "once" | "weekly" | "biweekly" | "semimonthly" | "monthly" | "yearly";

export interface Schedule {
  frequency: Frequency;
  anchorDate?: ISODate;        // a known occurrence (once, weekly, biweekly, yearly)
  dayOfMonth?: number;         // monthly and semimonthly; clamp to the last day of short months
  secondDayOfMonth?: number;   // semimonthly only
  startDate?: ISODate;         // optional: no occurrence before this date (a recurring bill that has not started yet)
}

export interface IncomeSource {
  id: string; label: string; amountCents: Cents; schedule: Schedule;
  isPaycheck: boolean;         // paycheck dates are the contribution dates
}
export interface Bill {
  id: string; label: string; amountCents: Cents; schedule: Schedule;
  category: string;
  cancellable: boolean;        // advice may suggest cutting it
  shiftable: boolean;          // advice may suggest moving its due date
  maxShiftDays?: number;       // default 10
}
export interface SpendingCategory {
  id: string; label: string; monthlyAmountCents: Cents;
  cuttable: boolean; maxCutPercent: number;   // 0 to 100
}
/** Positive amount plus a direction, matching the team data convention. */
export interface OneOffEvent {
  id: string; label: string; date: ISODate; amountCents: Cents;
  type: "income" | "expense";
}
export interface AccountSnapshot {
  id: string; nickname: string; type: "checking" | "savings";
  balanceCents: Cents;
  includeInForecast: boolean;  // starting cash = sum of included accounts
}

export interface Scenario {
  id: string; label: string; customerName: string;
  /** "Today", decided on the server. Balances are end-of-day on this date; items dated on it are already posted. */
  asOfDate: ISODate;
  accounts: AccountSnapshot[];
  income: IncomeSource[];
  bills: Bill[];
  spending: SpendingCategory[];
  oneOffs: OneOffEvent[];
  /** Outstanding liabilities at the snapshot date, not spendable cash. Payments are in bills. */
  debts?: { id: string; label: string; balanceCents: Cents; monthlyPaymentCents: Cents }[];
  /** How much recorded history the spending averages rest on; absent for hand-built scenarios. */
  spendingCoverage?: SpendingCoverage;
}

/**
 * Data coverage behind the spending averages, not a statistical confidence: missing records look
 * the same as no spending, so a thin history can understate it.
 */
export interface SpendingCoverage {
  level: "established" | "limited" | "insufficient";
  /** Months between the first record in the six-month window and today, one decimal. */
  months: number;
  /** Everyday-spending records in the window. */
  spendRecords: number;
}

/** Changes the advice engine tests without mutating the scenario. */
export interface ScenarioMods {
  removedBillIds?: string[];
  /** Monthly bills only: bill id to new day of month. */
  billDueDays?: Record<string, number>;
  /** Category id to cut percent, 0 to 100. */
  categoryCutPercents?: Record<string, number>;
}

// Engine outputs
export interface DayPoint {
  date: ISODate;
  baseCents: Cents;       // cash with no goal
  earmarkCents: Cents;    // e(d)
  committedCents: Cents;  // c(d)
  spendableCents: Cents;  // baseCents minus committedCents
}
export interface Violation {
  date: ISODate; kind: "negative" | "below-buffer"; shortfallCents: Cents;
}
export type Tier = "ok" | "notice" | "alert";

export interface Plan {
  contributionCents: Cents;
  affordableDate: ISODate | null;   // null: not affordable within the horizon
  affordableNow: boolean;
  paycheckCount: number;            // contributions needed
  violations: Violation[];
  tier: Tier;
  /** Lowest cash left after the earmark on any day, and when. */
  lowestSpendableCents: Cents;
  lowestSpendableDate: ISODate;
}
export interface FundingPoint {
  date: ISODate; earmarkCents: Cents; percentFunded: number;  // 0 to 100
  spendableCents: Cents;
}
export interface Forecast {
  asOfDate: ISODate;
  horizonEndDate: ISODate;
  suggestedContributionCents: Cents;
  limitContributionCents: Cents;
  plan: Plan;                       // plan for the contribution in effect
  days: DayPoint[];                 // daily series across the horizon
  funding: FundingPoint[];          // one point per paycheck date, for the charts
}

export type ForecastIssue = "missing-cost" | "invalid-goal" | "no-paycheck";
export type ForecastResult =
  | { ok: true; forecast: Forecast }
  | { ok: false; issue: ForecastIssue; message: string };

export interface AdviceItem {
  id: string;
  type: "raise-contribution" | "shift-bill" | "cut-recurring" | "trim-category";
  title: string;            // e.g. "Cancel Gym"
  reason: string;           // templated, plain language
  daysSooner: number | null;
  newAffordableDate: ISODate | null;
  ease: "easy" | "medium" | "hard";
  meetsDeadline: boolean;
  params: Record<string, string | number>;   // e.g. billId, newDay, cutPercent, newContributionCents
}
export interface AdviceResult {
  onTrack: boolean;
  gapDays: number | null;
  items: AdviceItem[];                       // ranked
  combined: { itemIds: string[]; reachesDeadline: boolean; earliestDate: ISODate | null } | null;
}

export interface StoredState {
  version: 1;
  goals: Goal[];
  activeGoalId: string | null;  // at most one active goal
  queue: string[];
}

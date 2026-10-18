export type RangePreset = "this-month" | "last-month" | "this-year" | "last-year" | "custom";
export interface DateRange { start: string; end: string }
export type SectionId = "overview" | "chartBalance" | "chartCategory" | "chartIncomeExpense" | "chartGoals" | "billsPaychecks" | "forecastCalendar" | "transactions" | "cardsRewards" | "advisorSolver";
export type SectionAvailability = { available: true } | { available: false; reason: string };
export interface ReportConfig { range: DateRange; preset: RangePreset; sections: Record<SectionId, boolean>; compareToPrevious: boolean }
/** All monetary values are integer cents, including the summary request. */
export interface Delta { current: number; previous: number; change: number; pct: number | null }
export interface Totals { incomeCents: number; spendingCents: number; netCents: number; billsPaidCents: number; savingsContributedCents: number }
export interface ReportTransaction {
  date: string; label: string; category: string; accountLabel: string; accountNumber?: string;
  amountCents: number; kind: "income" | "spending" | "internal-transfer" | "savings"; billPayment?: boolean;
}
export interface CategorySlice { category: string; amountCents: number; pctOfTotal: number }
export interface BalancePoint { date: string; balanceCents: number; isForecast: boolean }
export interface FlowBucket { start: string; end: string; label: string; incomeCents: number; expensesCents: number }
export interface GoalProgress { name: string; targetCents: number; savedCents: number | null; pct: number | null; estimatedCompletion?: string; asOfDate: string }
export interface ScheduleRow { date: string; name: string; amountCents: number; status: "paid" | "upcoming" | "received" | "expected" }
export interface WeatherDay { date: string; level: 0 | 1 | 2 | 3 | 4 | 5; label: string; endBalanceCents: number }
export interface CardRewardRow { name: string; maskedNumber: string; spendCents: number | null; rewardsEarnedCents?: number; rewardsIfOptimalCents?: number }
export interface AdvisorScenario { itemName: string; date: string; costCents: number; verdict: string; lowestBalanceCents: number }
export interface SummaryStats {
  rangeLabel: string;
  totals: Pick<Totals, "incomeCents" | "spendingCents" | "netCents">;
  previous?: Pick<Totals, "incomeCents" | "spendingCents" | "netCents">;
  topCategories: { category: string; amountCents: number }[];
  forecast?: { lowestBalanceCents: number; lowestBalanceDate: string; worstWeather: string; stormDays: number };
}
export interface ReportData {
  meta: { title: string; range: DateRange; today: string; customerName: string; sourceLabel: string };
  includedSections: SectionId[]; notes: string[]; forecastWindow?: DateRange; bufferCents: number;
  keyNumbers?: Record<keyof Totals, Delta> & { endingBalanceCents: Delta | null };
  compareToPrevious: boolean; summary?: { text: string; source: "ai" | "fallback" }; summaryStats?: SummaryStats;
  balanceSeries?: BalancePoint[]; categoryBreakdown?: CategorySlice[]; flowBuckets?: FlowBucket[]; goals?: GoalProgress[];
  bills?: ScheduleRow[]; paychecks?: ScheduleRow[]; weatherDays?: WeatherDay[];
  transactions?: { rows: Omit<ReportTransaction, "accountNumber">[]; totalCount: number; truncated: boolean };
  cards?: CardRewardRow[];
  advisorSolver?: { advisorScenarios: AdvisorScenario[]; guidance: string[] };
}

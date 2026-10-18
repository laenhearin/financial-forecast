import type { ReportConfig, SectionAvailability, SectionId } from "./types";
export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "overview", label: "AI summary & key numbers" },
  { id: "chartBalance", label: "Balance over time" },
  { id: "chartCategory", label: "Spending by category" },
  { id: "chartIncomeExpense", label: "Income vs. expenses" },
  { id: "chartGoals", label: "Savings goal progress" },
  { id: "billsPaychecks", label: "Bills & paychecks" },
  { id: "forecastCalendar", label: "Forecast calendar" },
  { id: "transactions", label: "Transactions" },
  { id: "cardsRewards", label: "Credit cards & rewards" },
  { id: "advisorSolver", label: "Storm Solver & Purchase Advisor" },
];
export const DEFAULT_SECTIONS: Record<SectionId, boolean> = {
  overview: true,
  chartBalance: true,
  chartCategory: true,
  chartIncomeExpense: true,
  chartGoals: true,
  billsPaychecks: true,
  forecastCalendar: false,
  transactions: false,
  cardsRewards: false,
  advisorSolver: false,
};
/** All upstream modules exist. Empty data is different from an unavailable module. */
export function sectionAvailability(
  config: ReportConfig,
  today: string,
): Record<SectionId, SectionAvailability> {
  return Object.fromEntries(
    SECTIONS.map(({ id }) => [
      id,
      id === "forecastCalendar" && config.range.end < today
        ? {
            available: false,
            reason: "Only available when the range includes today or later",
          }
        : { available: true },
    ]),
  ) as Record<SectionId, SectionAvailability>;
}
export function includedSections(
  config: ReportConfig,
  today: string,
): SectionId[] {
  const availability = sectionAvailability(config, today);
  return SECTIONS.filter(
    ({ id }) => config.sections[id] && availability[id].available,
  ).map(({ id }) => id);
}

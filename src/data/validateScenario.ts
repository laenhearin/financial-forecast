import { formatDate, isISODate } from "../lib/dates";
import { formatUSD, isCents } from "../lib/money";
import { projectBase } from "../features/big-purchase/engine/base";
import type { Scenario, Schedule } from "../features/big-purchase/types";

export interface ScenarioIssue {
  /** Errors stop the forecast and show an error card; warnings are logged in development only. */
  level: "error" | "warning";
  message: string;
}

export function validateScenario(scenario: Scenario): ScenarioIssue[] {
  const issues: ScenarioIssue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });

  if (!isISODate(scenario.asOfDate)) error(`As-of date "${scenario.asOfDate}" is not a YYYY-MM-DD date.`);

  const seen = new Set<string>();
  const items: { id: string; label: string; amounts: number[]; schedule?: Schedule; date?: string }[] = [
    ...scenario.accounts.map(a => ({ id: a.id, label: a.nickname, amounts: [a.balanceCents] })),
    ...scenario.income.map(i => ({ id: i.id, label: i.label, amounts: [i.amountCents], schedule: i.schedule })),
    ...scenario.bills.map(b => ({ id: b.id, label: b.label, amounts: [b.amountCents], schedule: b.schedule })),
    ...scenario.spending.map(s => ({ id: s.id, label: s.label, amounts: [s.monthlyAmountCents] })),
    ...scenario.oneOffs.map(o => ({ id: o.id, label: o.label, amounts: [o.amountCents], date: o.date })),
  ];
  for (const item of items) {
    if (seen.has(item.id)) error(`Duplicate id "${item.id}".`);
    seen.add(item.id);
    if (item.amounts.some(amount => !isCents(amount))) error(`${item.label}: amount must be whole cents.`);
    if (item.date !== undefined && !isISODate(item.date)) error(`${item.label}: date "${item.date}" is not a YYYY-MM-DD date.`);
    if (item.schedule) checkSchedule(item.label, item.schedule, error);
  }
  for (const amount of [...scenario.income.map(i => i.amountCents), ...scenario.bills.map(b => b.amountCents), ...scenario.spending.map(s => s.monthlyAmountCents), ...scenario.oneOffs.map(o => o.amountCents)]) {
    if (amount < 0) { error("Income, bill, spending, and one-off amounts must be positive; use the type field for direction."); break; }
  }
  for (const category of scenario.spending) {
    if (!(category.maxCutPercent >= 0 && category.maxCutPercent <= 100)) error(`${category.label}: maxCutPercent must be 0 to 100.`);
  }
  for (const bill of scenario.bills) {
    if (bill.maxShiftDays !== undefined && !(Number.isInteger(bill.maxShiftDays) && bill.maxShiftDays >= 0)) error(`${bill.label}: maxShiftDays must be a nonnegative integer.`);
  }
  if (!scenario.income.some(income => income.isPaycheck)) error("The scenario has no paycheck income, so there are no contribution dates.");

  if (issues.length === 0) {
    const negative = projectBase(scenario).days.find(day => day.baseCents < 0);
    if (negative) {
      issues.push({ level: "warning", message: `Base cash goes negative (${formatUSD(negative.baseCents)}) on ${formatDate(negative.date, "full")}.` });
    }
  }
  return issues;
}

function checkSchedule(label: string, schedule: Schedule, error: (message: string) => void) {
  const dayOk = (day: number | undefined) => day !== undefined && Number.isInteger(day) && day >= 1 && day <= 31;
  switch (schedule.frequency) {
    case "monthly":
      if (!dayOk(schedule.dayOfMonth)) error(`${label}: day of month must be 1 to 31.`);
      break;
    case "semimonthly":
      if (!dayOk(schedule.dayOfMonth) || !dayOk(schedule.secondDayOfMonth)) error(`${label}: both days of month must be 1 to 31.`);
      break;
    case "once": case "weekly": case "biweekly": case "yearly":
      if (!schedule.anchorDate || !isISODate(schedule.anchorDate)) error(`${label}: anchorDate must be a YYYY-MM-DD date.`);
      break;
    default:
      error(`${label}: unknown frequency.`);
  }
}

/** Logs every issue in development; production relies on the error card instead. */
export function reportScenarioIssues(scenarioId: string, issues: ScenarioIssue[]): void {
  if (process.env.NODE_ENV === "production") return;
  for (const issue of issues) console.warn(`[scenario ${scenarioId}] ${issue.level}: ${issue.message}`);
}

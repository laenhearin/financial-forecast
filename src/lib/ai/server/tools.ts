import "server-only";
import { addDays, daysBetween, isISODate } from "@/lib/dates";
import { computeForecast } from "@/features/big-purchase/engine/forecast";
import { MAX_COST_CENTS } from "@/features/big-purchase/config";
import { defaultBufferCents } from "@/features/big-purchase/state/goalStore";
import { PURCHASE_NAME_MAX_LENGTH } from "@/features/calendar/config";
import { BALANCE_LABELS, balanceLevel } from "@/features/calendar/engine/balanceThresholds";
import { forecastEndDate } from "@/features/calendar/engine/entries";
import { buildCalendarModel } from "@/features/calendar/engine/model";
import { ALL_ACCOUNTS, type CalendarEntry } from "@/features/calendar/types";
import { buildAdvisorFacts } from "../facts/advisor";
import { toPromptFacts } from "../promptJson";
import { MAX_PURCHASE_CENTS } from "../validate";
import type { ToolDeclaration } from "./client";
import type { FinanceContext } from "./context";

/**
 * Read-only tools for the ask box. Each wraps an existing engine function and returns JSON in
 * dollars. Invalid arguments come back as { error } so the model can recover; nothing throws, and
 * nothing writes to Nessie, storage or app state. Append new tools (for example a Storm Solver
 * plan or best card for a category) to TOOL_DECLARATIONS and HANDLERS.
 */
export const MAX_FORECAST_RANGE_DAYS = 31;

export const TOOL_DECLARATIONS: readonly ToolDeclaration[] = [
  {
    name: "checkPurchase",
    description: "Evaluate whether the user can afford a one-time purchase on a date, using the app's forecast. Use for any 'can I afford...' or 'what if I buy...' question. Returns the app's verdict level, the lowest balance with and without the purchase, days that get worse, the next paycheck, and an earlier-safe date when the verdict is risky.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Purchase cost in dollars, for example 400 or 89.99." },
        date: { type: "string", description: "Purchase date as YYYY-MM-DD. Omit for today." },
        label: { type: "string", description: "Short name of the purchase, for example 'headphones'." },
      },
      required: ["amount"],
    },
  },
  {
    name: "getForecast",
    description: `Get the projected end-of-day balance, balance level and scheduled items for a date range (at most ${MAX_FORECAST_RANGE_DAYS} days, within the forecast window). Use for questions about specific days or ranges beyond the baseline summary.`,
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "First day, YYYY-MM-DD." },
        endDate: { type: "string", description: "Last day, YYYY-MM-DD." },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "getGoalTimeline",
    description: "Estimate when the user can afford a savings goal by setting money aside every paycheck. If contributionPerPaycheck is omitted, the app's suggested contribution is used. Returns the affordable date, the contribution used, the suggested and largest safe contributions, and how many paychecks it takes.",
    parameters: {
      type: "object",
      properties: {
        cost: { type: "number", description: "Goal cost in dollars." },
        contributionPerPaycheck: { type: "number", description: "Dollars set aside each paycheck. Optional." },
      },
      required: ["cost"],
    },
  },
  {
    name: "getDayDetail",
    description: "Explain one day: its balance level, start and end balance, and the bills, deposits and other items on it. Use for 'why is Friday near critical?' questions.",
    parameters: {
      type: "object",
      properties: { date: { type: "string", description: "The day, YYYY-MM-DD." } },
      required: ["date"],
    },
  },
];

type Args = Record<string, unknown>;
type Handler = (args: Args, context: FinanceContext) => unknown;

const HANDLERS: Record<string, Handler> = {
  checkPurchase(args, context) {
    const amountCents = dollars(args.amount, MAX_PURCHASE_CENTS);
    if (amountCents === null) return { error: "amount must be a positive dollar amount up to 1,000,000." };
    const date = args.date === undefined ? context.today : windowDate(args.date, context);
    if (date === null) return { error: `date must be YYYY-MM-DD between ${context.today} and ${forecastEnd(context)}.` };
    const label = typeof args.label === "string" && args.label.trim() ? args.label.trim().slice(0, PURCHASE_NAME_MAX_LENGTH) : "Purchase";
    const accountId = context.scenario.accounts[0]?.id;
    if (!accountId) return { error: "No account is available for this profile." };
    return toPromptFacts(buildAdvisorFacts(context.scenario, context.purchases, { label, amountCents, date, accountId }, context.criticalCents, context.entries));
  },

  getForecast(args, context) {
    const start = windowDate(args.startDate, context);
    const end = windowDate(args.endDate, context);
    if (start === null || end === null) return { error: `dates must be YYYY-MM-DD between ${context.today} and ${forecastEnd(context)}.` };
    if (end < start) return { error: "endDate must be on or after startDate." };
    if (daysBetween(start, end) + 1 > MAX_FORECAST_RANGE_DAYS) return { error: `The range can cover at most ${MAX_FORECAST_RANGE_DAYS} days.` };
    const model = calendar(context);
    const days = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      const cents = model.balances.get(date)?.totalCents ?? null;
      days.push({
        date,
        level: BALANCE_LABELS[balanceLevel(cents, context.criticalCents)],
        endBalanceCents: cents,
        items: (model.entriesByDate.get(date) ?? []).map(item),
      });
    }
    return toPromptFacts({ criticalBalanceCents: context.criticalCents, days });
  },

  getGoalTimeline(args, context) {
    const costCents = dollars(args.cost, MAX_COST_CENTS);
    if (costCents === null) return { error: "cost must be a positive dollar amount up to 250,000." };
    let contributionCents: number | null = null;
    if (args.contributionPerPaycheck !== undefined) {
      contributionCents = dollars(args.contributionPerPaycheck, MAX_COST_CENTS);
      if (contributionCents === null) return { error: "contributionPerPaycheck must be a positive dollar amount." };
    }
    const bufferCents = defaultBufferCents(costCents);
    const result = computeForecast(context.scenario, { costCents, bufferCents, contributionCents });
    if (!result.ok) return { error: result.message };
    const { forecast } = result;
    return toPromptFacts({
      costCents,
      reserveKeptCents: bufferCents,
      affordableNow: forecast.plan.affordableNow,
      affordableDate: forecast.plan.affordableDate,
      contributionPerPaycheckCents: forecast.plan.contributionCents,
      suggestedContributionPerPaycheckCents: forecast.suggestedContributionCents,
      largestSafeContributionPerPaycheckCents: forecast.limitContributionCents,
      paychecksNeeded: forecast.plan.paycheckCount,
      searchedThrough: forecast.horizonEndDate,
      note: forecast.plan.affordableDate === null && !forecast.plan.affordableNow ? "Not affordable within the 24-month horizon at this contribution." : undefined,
    });
  },

  getDayDetail(args, context) {
    const date = windowDate(args.date, context);
    if (date === null) return { error: `date must be YYYY-MM-DD between ${context.today} and ${forecastEnd(context)}.` };
    const model = calendar(context);
    const endCents = model.balances.get(date)?.totalCents ?? null;
    const startCents = date === context.today ? model.startingCents : model.balances.get(addDays(date, -1))?.totalCents ?? null;
    const items = model.entriesByDate.get(date) ?? [];
    return toPromptFacts({
      date,
      level: BALANCE_LABELS[balanceLevel(endCents, context.criticalCents)],
      criticalBalanceCents: context.criticalCents,
      startBalanceCents: startCents,
      endBalanceCents: endCents,
      note: date === context.today ? "Items dated today are already included in today's balance." : undefined,
      bills: items.filter((entry) => entry.kind === "bill").map(item),
      deposits: items.filter((entry) => entry.kind === "income").map(item),
      otherSpending: items.filter((entry) => entry.kind !== "bill" && entry.kind !== "income").map(item),
    });
  },
};

/** Runs one tool call. Never throws: unknown tools and bad arguments return { error }. */
export function dispatchTool(name: string, args: unknown, context: FinanceContext): unknown {
  const handler = Object.hasOwn(HANDLERS, name) ? HANDLERS[name] : undefined;
  if (!handler) return { error: `Unknown tool "${name}".` };
  if (typeof args !== "object" || args === null || Array.isArray(args)) return { error: "Arguments must be an object." };
  try {
    return handler(args as Args, context);
  } catch {
    return { error: "The forecast could not answer that." };
  }
}

/** Short, non-identifying summary of a call for debug logs. */
export function describeToolCall(name: string, args: unknown): string {
  if (typeof args !== "object" || args === null) return name;
  const parts = Object.entries(args as Args)
    .filter(([key]) => key !== "label")
    .map(([key, value]) => `${key}=${typeof value === "number" || typeof value === "string" ? String(value).slice(0, 24) : typeof value}`);
  return `${name}(${parts.join(", ")})`;
}

function calendar(context: FinanceContext) {
  return buildCalendarModel(context.scenario, context.purchases, ALL_ACCOUNTS, context.entries);
}

function forecastEnd(context: FinanceContext): string {
  return forecastEndDate(context.today);
}

function windowDate(value: unknown, context: FinanceContext): string | null {
  if (typeof value !== "string" || !isISODate(value)) return null;
  return value >= context.today && value <= forecastEnd(context) ? value : null;
}

/** Positive dollars with at most two decimals, as cents. */
function dollars(value: unknown, maxCents: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && cents <= maxCents ? cents : null;
}

function item(entry: CalendarEntry) {
  return { label: entry.label, amountCents: entry.amountCents, kind: entry.kind };
}

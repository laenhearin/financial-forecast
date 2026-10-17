/**
 * Request-body validation for the AI routes. Pure and client-safe. Every parser rejects unknown
 * keys and returns null on any problem, so raw request JSON never reaches a prompt.
 */
import { isISODate } from "@/lib/dates";
import { isCents } from "@/lib/money";
import { PURCHASE_NAME_MAX_LENGTH } from "@/features/calendar/config";
import { GOAL_NAME_MAX_LENGTH, MAX_COST_CENTS } from "@/features/big-purchase/config";
import type { AdvisorRequest, AskRequest, AskTurn, GoalSummaryRequest, PurchaseInput, SavedPurchaseInput } from "./types";

export const MAX_QUESTION_LENGTH = 500;
export const MAX_HISTORY_TURNS = 4;
export const MAX_TURN_LENGTH = 500;
export const MAX_SAVED_PURCHASES = 40;
/** $1,000,000 */
export const MAX_PURCHASE_CENTS = 100_000_000;
const MAX_ID_LENGTH = 80;

type Obj = Record<string, unknown>;

function object(value: unknown, keys: readonly string[], optional: readonly string[] = []): Obj | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const allowed = new Set([...keys, ...optional]);
  const own = Object.keys(value);
  if (own.some((key) => !allowed.has(key))) return null;
  if (keys.some((key) => !(key in value))) return null;
  return value as Obj;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function cents(value: unknown, max: number, min = 0): number | null {
  return isCents(value) && value >= min && value <= max ? value : null;
}

function date(value: unknown): string | null {
  return typeof value === "string" && isISODate(value) ? value : null;
}

/** null or omitted means "use the profile's default". */
function optionalCents(value: unknown, max: number): number | null | undefined {
  if (value === undefined || value === null) return null;
  return cents(value, max) ?? undefined;
}

export function parsePurchaseInput(value: unknown): PurchaseInput | null {
  const body = object(value, ["label", "amountCents", "date", "accountId"]);
  if (!body) return null;
  const label = text(body.label, PURCHASE_NAME_MAX_LENGTH);
  const amountCents = cents(body.amountCents, MAX_PURCHASE_CENTS, 1);
  const day = date(body.date);
  const accountId = text(body.accountId, MAX_ID_LENGTH);
  return label && amountCents !== null && day && accountId ? { label, amountCents, date: day, accountId } : null;
}

export function parseSavedPurchases(value: unknown): SavedPurchaseInput[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_SAVED_PURCHASES) return null;
  const out: SavedPurchaseInput[] = [];
  for (const item of value) {
    const body = object(item, ["id", "label", "amountCents", "date", "accountId"]);
    const id = body ? text(body.id, MAX_ID_LENGTH) : null;
    const purchase = body ? parsePurchaseInput({ label: body.label, amountCents: body.amountCents, date: body.date, accountId: body.accountId }) : null;
    if (!id || !purchase) return null;
    out.push({ id, ...purchase });
  }
  return out;
}

export function parseAdvisorRequest(value: unknown): AdvisorRequest | null {
  const body = object(value, ["purchase"], ["criticalBalanceCents", "purchases"]);
  if (!body) return null;
  const purchase = parsePurchaseInput(body.purchase);
  const criticalBalanceCents = optionalCents(body.criticalBalanceCents, MAX_PURCHASE_CENTS);
  const purchases = parseSavedPurchases(body.purchases);
  if (!purchase || criticalBalanceCents === undefined || !purchases) return null;
  return { purchase, criticalBalanceCents, purchases };
}

export function parseGoalSummaryRequest(value: unknown): GoalSummaryRequest | null {
  const body = object(value, ["goal"]);
  const goal = body ? object(body.goal, ["name", "costCents", "bufferCents", "contributionCents", "deadline"]) : null;
  if (!goal) return null;
  const name = text(goal.name, GOAL_NAME_MAX_LENGTH);
  const costCents = cents(goal.costCents, MAX_COST_CENTS, 1);
  const bufferCents = cents(goal.bufferCents, MAX_COST_CENTS);
  const contributionCents = goal.contributionCents === null ? null : cents(goal.contributionCents, MAX_COST_CENTS);
  const deadline = goal.deadline === null ? null : date(goal.deadline);
  if (!name || costCents === null || bufferCents === null) return null;
  if (goal.contributionCents !== null && contributionCents === null) return null;
  if (goal.deadline !== null && deadline === null) return null;
  return { goal: { name, costCents, bufferCents, contributionCents, deadline } };
}

export function parseAskRequest(value: unknown): AskRequest | null {
  const body = object(value, ["question"], ["history", "criticalBalanceCents", "purchases"]);
  if (!body) return null;
  const question = text(body.question, MAX_QUESTION_LENGTH);
  const criticalBalanceCents = optionalCents(body.criticalBalanceCents, MAX_PURCHASE_CENTS);
  const purchases = parseSavedPurchases(body.purchases);
  const history = parseHistory(body.history);
  if (!question || criticalBalanceCents === undefined || !purchases || !history) return null;
  return { question, history, criticalBalanceCents, purchases };
}

/** Keeps the last turns, each cut to a bounded length. */
function parseHistory(value: unknown): AskTurn[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const turns: AskTurn[] = [];
  for (const item of value) {
    const turn = object(item, ["role", "text"]);
    if (!turn || (turn.role !== "user" && turn.role !== "assistant") || typeof turn.text !== "string") return null;
    const trimmed = turn.text.trim().slice(0, MAX_TURN_LENGTH);
    if (trimmed) turns.push({ role: turn.role, text: trimmed });
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

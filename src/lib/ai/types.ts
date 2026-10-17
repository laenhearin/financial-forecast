/**
 * Shared AI-layer types. Safe for client and server: nothing here reads secrets.
 * Money is integer cents (keys end in "Cents"); dollars appear only in the JSON sent to the model.
 */
import type { BalanceLevel } from "@/features/calendar/engine/balanceThresholds";
import type { Cents, ISODate } from "@/features/big-purchase/types";

export type { Cents, ISODate };

/** Registered AI surfaces. A new surface adds a prompt, a facts builder, a schema and a template. */
export type AiSurface = "advisor" | "goal-summary" | "ask" | "cash-back-classify";

export type AiSource = "model" | "cache" | "template";

/** Why a surface answered from a template. Never includes upstream error text. */
export type AiFallbackReason =
  | "disabled" | "forced" | "no-key"
  | "rate_limited" | "billing" | "unavailable" | "timeout" | "bad_output" | "auth" | "other"
  | "audit";

export interface AiMeta {
  source: AiSource;
  model?: string;
  latencyMs: number;
  auditFlags?: string[];
  fallbackReason?: AiFallbackReason;
}

export interface DatedCents { date: ISODate; cents: Cents }

// ---- Purchase Advisor (surface B) and the ask box's checkPurchase tool ----

export interface AdvisorFacts {
  purchase: { label: string; amountCents: Cents; date: ISODate };
  /** Engine verdict on the lowest balance after the purchase date (0 THRIVING ... 5 BELOW $0). */
  level: BalanceLevel;
  levelLabel: string;
  /** The engine's recommendation headline shown on the Advisor page. */
  recommendation: string;
  criticalBalanceCents: Cents;
  startingBalanceCents: Cents;
  lowestWithPurchase: DatedCents;
  lowestWithoutPurchase: DatedCents;
  /** Days from the purchase date on whose balance level gets worse (first few only). */
  worsenedDays: Array<{ date: ISODate; from: string; to: string }>;
  worsenedDayCount: number;
  nextPaycheck: { date: ISODate; amountCents: Cents } | null;
  /** First later date where buying keeps the lowest balance at CAUTION or better; only for risky verdicts. */
  earliestSaferDate: ISODate | null;
  forecastEnd: ISODate;
}

export interface AdvisorExplanation {
  headline: string;
  explanation: string;
  alternative: string | null;
}

/** What the browser sends: inputs only. The server recomputes every number with the engine. */
export interface PurchaseInput {
  label: string;
  amountCents: Cents;
  date: ISODate;
  accountId: string;
}

/** A purchase the user saved in the calendar (localStorage), possibly a monthly series. */
export interface SavedPurchaseInput extends PurchaseInput {
  id: string;
  recurring?: boolean;
  cancelFromDate?: ISODate;
  skippedDates?: ISODate[];
}

export interface AdvisorRequest {
  purchase: PurchaseInput;
  criticalBalanceCents: Cents | null;
  purchases: SavedPurchaseInput[];
}

export type AdvisorResponse = { explanation: AdvisorExplanation; meta: AiMeta };

// ---- Big Purchase summary (surface C) ----

export interface GoalSummaryFacts {
  goalName: string;
  costCents: Cents;
  bufferCents: Cents;
  contributionPerPaycheckCents: Cents;
  affordableNow: boolean;
  affordableDate: ISODate | null;
  horizonEndDate: ISODate;
  deadline: ISODate | null;
  /** Null when no advice was requested. */
  onTrack: boolean | null;
  /** Engine-ranked changes; dates and day counts come from the advice engine. */
  changes: Array<{ title: string; reason: string; daysSooner: number | null; newAffordableDate: ISODate | null; meetsDeadline: boolean }>;
  combined: { count: number; reachesDeadline: boolean; earliestDate: ISODate | null } | null;
}

export interface GoalSummaryRequest {
  goal: { name: string; costCents: Cents; bufferCents: Cents; contributionCents: Cents | null; deadline: ISODate | null };
}

export type GoalSummaryResponse = { summary: string; meta: AiMeta };

// ---- Ask box (surface A) ----

export interface AskTurn { role: "user" | "assistant"; text: string }

export interface AskRequest {
  question: string;
  history: AskTurn[];
  criticalBalanceCents: Cents | null;
  purchases: SavedPurchaseInput[];
}

export type AskStreamEvent =
  | { type: "tool"; name: string }
  | { type: "text"; delta: string }
  | { type: "done"; meta: AiMeta }
  | { type: "error"; message: string };

export interface Baseline {
  today: ISODate;
  currentBalanceCents: Cents;
  criticalBalanceCents: Cents;
  horizonDays: number;
  days: Array<{ date: ISODate; level: string; endBalanceCents: Cents }>;
  upcoming: Array<{ date: ISODate; label: string; amountCents: Cents; kind: "bill" | "income" | "planned" | "purchase" }>;
  lowestBalance: DatedCents & { level: string };
  worstDays: ISODate[];
}

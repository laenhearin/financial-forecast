import { isISODate } from "../../../lib/dates";
import { isCents } from "../../../lib/money";
import { ACTIVE_PROFILE_STORAGE_KEY, DEFAULT_BUFFER_MIN_CENTS, DEFAULT_BUFFER_PERCENT, GOAL_NAME_MAX_LENGTH, MAX_COST_CENTS, STORAGE_KEY } from "../config";
import type { Cents, Goal, GoalStatus, ISODate, StoredState } from "../types";

// ---------- Goal rules (pure, tested) ----------

/** The higher of $200 or 15% of the cost. */
export function defaultBufferCents(costCents: Cents): Cents {
  return Math.max(DEFAULT_BUFFER_MIN_CENTS, Math.round(Math.max(0, costCents) * DEFAULT_BUFFER_PERCENT));
}

export function createGoal(id: string, today: ISODate, fields: { name?: string; costCents?: Cents; bufferCents?: Cents } = {}): Goal {
  const costCents = fields.costCents ?? 0;
  const bufferIsCustom = fields.bufferCents !== undefined && fields.bufferCents !== defaultBufferCents(costCents);
  return {
    id,
    name: (fields.name ?? "").slice(0, GOAL_NAME_MAX_LENGTH),
    costCents,
    bufferCents: bufferIsCustom ? fields.bufferCents! : defaultBufferCents(costCents),
    bufferIsCustom,
    priority: 1,
    status: "draft",
    contributionCents: null,
    preferredDeadline: null,
    createdAt: today,
    updatedAt: today,
  };
}

export type GoalPatch =
  | { field: "name"; value: string }
  | { field: "cost"; value: Cents }
  | { field: "buffer"; value: Cents }
  | { field: "useSuggestedBuffer" }
  | { field: "contribution"; value: Cents | null }
  | { field: "deadline"; value: ISODate | null };

/** Applies one edit. The buffer follows the cost until the user edits the buffer. */
export function updateGoal(goal: Goal, patch: GoalPatch, today: ISODate): Goal {
  const next = { ...goal, updatedAt: today };
  switch (patch.field) {
    case "name": return { ...next, name: patch.value.slice(0, GOAL_NAME_MAX_LENGTH) };
    case "cost": return { ...next, costCents: patch.value, bufferCents: goal.bufferIsCustom ? goal.bufferCents : defaultBufferCents(patch.value) };
    case "buffer": return { ...next, bufferCents: patch.value, bufferIsCustom: true };
    case "useSuggestedBuffer": return { ...next, bufferCents: defaultBufferCents(goal.costCents), bufferIsCustom: false };
    case "contribution": return { ...next, contributionCents: patch.value };
    case "deadline": return { ...next, preferredDeadline: patch.value };
  }
}

export interface GoalErrors { name?: string; cost?: string; buffer?: string; contribution?: string }

export function validateGoal(goal: Goal): GoalErrors {
  const errors: GoalErrors = {};
  const name = goal.name.trim();
  if (!name) errors.name = "Enter a name.";
  else if (name.length > GOAL_NAME_MAX_LENGTH) errors.name = `Use ${GOAL_NAME_MAX_LENGTH} characters or fewer.`;
  if (!isCents(goal.costCents) || goal.costCents <= 0) errors.cost = "Enter a cost above $0.";
  else if (goal.costCents > MAX_COST_CENTS) errors.cost = "Keep the cost at or under $500,000.";
  if (!isCents(goal.bufferCents) || goal.bufferCents < 0) errors.buffer = "Enter a buffer of $0 or more.";
  if (goal.contributionCents !== null && (!isCents(goal.contributionCents) || goal.contributionCents < 0)) errors.contribution = "Enter $0 or more.";
  return errors;
}

export function isGoalValid(goal: Goal): boolean {
  return Object.keys(validateGoal(goal)).length === 0;
}

export type RuleResult = { ok: true; goal: Goal } | { ok: false; reason: string };

/** Active needs valid inputs; going back to draft is always allowed (the UI confirms first). */
export function setGoalStatus(goal: Goal, status: GoalStatus, today: ISODate): RuleResult {
  if (status === goal.status) return { ok: true, goal };
  if (status === "active" && !isGoalValid(goal)) return { ok: false, reason: "Finish the name and cost before activating." };
  return { ok: true, goal: { ...goal, status, updatedAt: today } };
}

export function canReset(goal: Goal): boolean {
  return goal.status === "draft";
}

/** Restores defaults (empty name and cost, default buffer, no contribution or deadline). Rejected for an active goal. */
export function resetGoal(goal: Goal, today: ISODate): RuleResult {
  if (!canReset(goal)) return { ok: false, reason: "Switch to draft to reset." };
  return { ok: true, goal: { ...createGoal(goal.id, goal.createdAt), updatedAt: today } };
}

// ---------- Stored state ----------

export function emptyState(): StoredState {
  return { version: 1, goals: [], activeGoalId: null, queue: [] };
}

/** Adds or updates a goal without discarding any other saved goals. */
export function withGoal(state: StoredState, goal: Goal): StoredState {
  let goals = state.goals.some(existing => existing.id === goal.id)
    ? state.goals.map(existing => existing.id === goal.id ? goal : existing)
    : [...state.goals, goal];
  if (goal.status === "active") {
    goals = goals.map(existing => existing.id !== goal.id && existing.status === "active"
      ? { ...existing, status: "draft" }
      : existing);
  }
  const activeGoalId = goal.status === "active" ? goal.id : state.activeGoalId === goal.id ? null : state.activeGoalId;
  return { ...state, goals, activeGoalId };
}

export function parseStoredState(raw: string | null): StoredState {
  if (!raw) return emptyState();
  try {
    const value = JSON.parse(raw) as Partial<StoredState>;
    if (value.version !== 1 || !Array.isArray(value.goals)) return emptyState();
    const goals = value.goals.filter(isStoredGoal);
    const activeGoalId = goals.some(goal => goal.id === value.activeGoalId && goal.status === "active") ? value.activeGoalId! : null;
    return { version: 1, goals, activeGoalId, queue: Array.isArray(value.queue) ? value.queue.filter(id => typeof id === "string") : [] };
  } catch {
    return emptyState();
  }
}

function isStoredGoal(value: unknown): value is Goal {
  const goal = value as Goal;
  return typeof goal === "object" && goal !== null
    && typeof goal.id === "string" && typeof goal.name === "string"
    && isCents(goal.costCents) && isCents(goal.bufferCents) && typeof goal.bufferIsCustom === "boolean"
    && (goal.status === "draft" || goal.status === "active")
    && (goal.contributionCents === null || isCents(goal.contributionCents))
    && (goal.preferredDeadline === null || (typeof goal.preferredDeadline === "string" && isISODate(goal.preferredDeadline)))
    && typeof goal.priority === "number";
}

// ---------- Browser store (local storage behind useSyncExternalStore) ----------

let cached: { key: string; value: StoredState } | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  try {
    const slug = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "college";
    return `${STORAGE_KEY}.${slug}`;
  } catch {
    return `${STORAGE_KEY}.college`;
  }
}

function readStorage(key: string): StoredState {
  try {
    return parseStoredState(window.localStorage.getItem(key));
  } catch {
    return emptyState();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("cloudcash-profile-change", () => {
    cached = null;
    listeners.forEach(listener => listener());
  });
}

export const goalStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): StoredState {
    const key = storageKey();
    if (!cached || cached.key !== key) cached = { key, value: readStorage(key) };
    return cached.value;
  },
  getServerSnapshot(): StoredState | null {
    return null;
  },
  set(next: StoredState) {
    const key = storageKey();
    cached = { key, value: next };
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode, quota); the in-memory state still works.
    }
    listeners.forEach(listener => listener());
  },
};

import { describe, expect, it } from "vitest";
import { MAX_COST_CENTS } from "../config";
import { getEarmarkSummary } from "../selectors/earmark";
import type { Forecast } from "../types";
import { canReset, createGoal, defaultBufferCents, emptyState, isGoalValid, parseStoredState, resetGoal, setGoalStatus, updateGoal, withGoal } from "./goalStore";

const today = "2026-10-17";
const laptop = () => createGoal("g1", today, { name: "Laptop", costCents: 180_000 });

describe("buffer default", () => {
  it("is the higher of $200 or 15% of cost", () => {
    expect(defaultBufferCents(0)).toBe(20_000);
    expect(defaultBufferCents(100_000)).toBe(20_000);
    expect(defaultBufferCents(180_000)).toBe(27_000);
  });

  it("follows the cost until edited, then stays put until restored", () => {
    let goal = laptop();
    expect(goal.bufferCents).toBe(27_000);
    goal = updateGoal(goal, { field: "cost", value: 300_000 }, today);
    expect(goal).toMatchObject({ bufferCents: 45_000, bufferIsCustom: false });
    goal = updateGoal(goal, { field: "buffer", value: 50_000 }, today);
    goal = updateGoal(goal, { field: "cost", value: 400_000 }, today);
    expect(goal).toMatchObject({ bufferCents: 50_000, bufferIsCustom: true });
    goal = updateGoal(goal, { field: "useSuggestedBuffer" }, today);
    expect(goal).toMatchObject({ bufferCents: 60_000, bufferIsCustom: false });
  });
});

describe("status rules", () => {
  it("activates only valid goals", () => {
    expect(setGoalStatus(createGoal("g", today), "active", today).ok).toBe(false);
    expect(setGoalStatus({ ...laptop(), name: "  " }, "active", today).ok).toBe(false);
    expect(setGoalStatus({ ...laptop(), costCents: MAX_COST_CENTS + 1 }, "active", today).ok).toBe(false);
    expect(setGoalStatus({ ...laptop(), costCents: MAX_COST_CENTS }, "active", today).ok).toBe(true);
    const result = setGoalStatus(laptop(), "active", today);
    expect(result.ok && result.goal.status).toBe("active");
  });

  it("always allows going back to draft", () => {
    const result = setGoalStatus({ ...laptop(), status: "active" }, "draft", today);
    expect(result.ok && result.goal.status).toBe("draft");
  });

  it("keeps at most one active goal id in stored state", () => {
    const active = { ...laptop(), status: "active" as const };
    expect(withGoal(emptyState(), active).activeGoalId).toBe("g1");
    expect(withGoal(withGoal(emptyState(), active), laptop()).activeGoalId).toBeNull();
  });
});

describe("reset", () => {
  it("restores defaults on a draft and keeps the goal id", () => {
    const edited = updateGoal(updateGoal(laptop(), { field: "contribution", value: 30_000 }, today), { field: "deadline", value: "2027-01-01" }, today);
    const result = resetGoal(edited, "2026-10-18");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goal).toMatchObject({ id: "g1", name: "", costCents: 0, bufferCents: 20_000, bufferIsCustom: false, contributionCents: null, preferredDeadline: null, status: "draft", priority: 1 });
    expect(isGoalValid(result.goal)).toBe(false);
  });

  it("is rejected for an active goal", () => {
    const active = { ...laptop(), status: "active" as const };
    expect(canReset(active)).toBe(false);
    expect(resetGoal(active, today)).toEqual({ ok: false, reason: "Switch to draft to reset." });
  });
});

describe("stored state", () => {
  it("round-trips and ignores malformed data", () => {
    const state = withGoal(emptyState(), laptop());
    expect(parseStoredState(JSON.stringify(state))).toEqual(state);
    expect(parseStoredState("not json")).toEqual(emptyState());
    expect(parseStoredState(JSON.stringify({ version: 2, goals: [] }))).toEqual(emptyState());
    expect(parseStoredState(JSON.stringify({ version: 1, goals: [{ id: 1 }], activeGoalId: "x" })).goals).toEqual([]);
  });
});

describe("earmark selector", () => {
  it("labels the hold with the goal name and only counts it when active", () => {
    const forecast = { days: [{ earmarkCents: 180_000 }], plan: { contributionCents: 0 } } as unknown as Forecast;
    expect(getEarmarkSummary(laptop(), forecast)).toEqual({ label: "Laptop money", earmarkedTodayCents: 0, contributionCents: 0, targetCents: 180_000, status: "draft" });
    expect(getEarmarkSummary({ ...laptop(), status: "active" }, forecast).earmarkedTodayCents).toBe(180_000);
  });
});

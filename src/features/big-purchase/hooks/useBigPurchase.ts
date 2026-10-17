"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { generateAdvice } from "../advice/generateAdvice";
import { narrateWithAi, type Narration } from "../ai/narrator";
import { ADVICE_SHIMMER_MS, INPUT_DEBOUNCE_MS } from "../config";
import { computeForecast, type ForecastGoal } from "../engine/forecast";
import { createGoal, goalStore, isGoalValid, resetGoal, setGoalStatus, updateGoal, withGoal, type GoalPatch } from "../state/goalStore";
import type { AdviceResult, Cents, Forecast, ForecastResult, Goal, GoalStatus, ISODate, Scenario } from "../types";

const SOURCE_LABEL = "Synthetic Nessie data + local demo assumptions";

type ScenarioState =
  | { status: "loading" }
  | { status: "error"; message: string; details: string[] }
  | { status: "ready"; scenario: Scenario; demoGoal: Goal };

type AdviceState =
  | { status: "closed" }
  | { status: "loading" }
  | { status: "ready"; result: AdviceResult; deadline: ISODate | null; forecast: Forecast };

function newGoalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `goal-${Math.random().toString(36).slice(2)}`;
}

export function useBigPurchase({ seedDemoGoal = false }: { seedDemoGoal?: boolean } = {}) {
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ status: "loading" });
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => {
      setScenarioState({ status: "loading" });
      fetch("/api/demo-data", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { scenario?: Scenario; goal?: Goal; message?: string };
        if (!response.ok || !body.scenario || !body.goal) throw new Error(body.message ?? "The selected demo profile could not be loaded.");
        return { scenario: body.scenario, demoGoal: body.goal };
      }).then(({ scenario, demoGoal }) => {
        if (live) setScenarioState({ status: "ready", scenario, demoGoal });
      }).catch((error: unknown) => {
        if (!live) return;
        setScenarioState({
          status: "error",
          message: error instanceof Error ? error.message : "The scenario could not be loaded.",
          details: [],
        });
      });
    };
    load();
    window.addEventListener("cloudcash-profile-change", load);
    return () => { live = false; window.removeEventListener("cloudcash-profile-change", load); };
  }, []);

  const scenario = scenarioState.status === "ready" ? scenarioState.scenario : null;
  // The demo's fixed clock: "today" is the scenario's as-of date.
  const today = scenario?.asOfDate ?? null;

  const stored = useSyncExternalStore(goalStore.subscribe, goalStore.getSnapshot, goalStore.getServerSnapshot);
  const goals = stored?.goals ?? [];
  const goal: Goal | null = goals.find(item => item.id === selectedGoalId)
    ?? goals.find(item => item.id === stored?.activeGoalId)
    ?? goals[0]
    ?? (scenarioState.status === "ready" && goals.length === 0 ? scenarioState.demoGoal : null);
  const hydrated = stored !== null;

  useEffect(() => {
    if (seedDemoGoal && stored && stored.goals.length === 0 && today) {
      goalStore.set(withGoal(stored, createGoal(newGoalId(), today, { name: "Laptop", costCents: 180_000 })));
    }
  }, [seedDemoGoal, stored, today]);

  // Debounce the inputs that drive the forecast while the user types.
  const inputKey = goal ? `${goal.costCents}|${goal.bufferCents}|${goal.contributionCents ?? ""}` : "";
  const [debouncedKey, setDebouncedKey] = useState(inputKey);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(inputKey), INPUT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputKey]);

  // The first value (after loading from storage) skips the debounce so the page doesn't flash empty.
  const forecastKey = debouncedKey || inputKey;
  const forecastGoal: ForecastGoal | null = useMemo(() => {
    if (!forecastKey) return null;
    const [cost, buffer, contribution] = forecastKey.split("|");
    return { costCents: Number(cost), bufferCents: Number(buffer), contributionCents: contribution === "" ? null : Number(contribution) };
  }, [forecastKey]);
  const forecastResult: ForecastResult | null = useMemo(
    () => (scenario && forecastGoal ? computeForecast(scenario, forecastGoal) : null),
    [scenario, forecastGoal],
  );
  const forecast = forecastResult?.ok ? forecastResult.forecast : null;
  const activeGoal = goals.find(item => item.id === stored?.activeGoalId && item.status === "active") ?? null;
  const activeForecastResult = useMemo(() => {
    if (!scenario || !activeGoal) return null;
    if (activeGoal.id === goal?.id) return forecastResult;
    return computeForecast(scenario, activeGoal);
  }, [scenario, activeGoal, goal?.id, forecastResult]);
  const activeForecast = activeForecastResult?.ok ? activeForecastResult.forecast : null;
  const valid = goal ? isGoalValid(goal) : false;

  const affordableDate = forecast?.plan.affordableDate ?? null;
  const deadline: ISODate | null = forecast ? goal?.preferredDeadline ?? affordableDate ?? forecast.horizonEndDate : null;
  const needsHelp = Boolean(forecast && valid && (affordableDate === null || (deadline !== null && deadline < affordableDate)));

  // Advice runs on demand, then stays in sync with the deadline and forecast.
  const [advice, setAdvice] = useState<AdviceState>({ status: "closed" });
  const adviceOpen = advice.status !== "closed";
  const adviceLoading = advice.status === "loading";
  const adviceFresh = advice.status === "ready" && advice.forecast === forecast && advice.deadline === deadline;
  useEffect(() => {
    if (!adviceOpen || adviceFresh || !scenario || !forecast || !forecastGoal) return;
    const timer = setTimeout(() => {
      setAdvice({ status: "ready", result: generateAdvice(scenario, forecastGoal, forecast, deadline), deadline, forecast });
    }, adviceLoading ? ADVICE_SHIMMER_MS : INPUT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [adviceOpen, adviceFresh, adviceLoading, scenario, forecast, forecastGoal, deadline]);

  const [narration, setNarration] = useState<{ value: Narration; for: AdviceResult } | null>(null);
  const adviceResult = advice.status === "ready" ? advice.result : null;
  useEffect(() => {
    if (!adviceResult || !goal || !forecast) return;
    const controller = new AbortController();
    narrateWithAi({ goal: { ...goal, preferredDeadline: deadline }, forecast, advice: adviceResult }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setNarration({ value, for: adviceResult }); }, () => { if (!controller.signal.aborted) setNarration(null); });
    return () => controller.abort();
  }, [adviceResult, goal, forecast, deadline]);

  const save = useCallback((next: Goal) => {
    const state = goalStore.getSnapshot();
    goalStore.set(withGoal(state, next));
  }, []);

  const actions = {
    startGoal(fields: { name: string; costCents: Cents; bufferCents: Cents }) {
      if (!today) return;
      const next = createGoal(newGoalId(), today, fields);
      save(next);
      setSelectedGoalId(next.id);
    },
    selectGoal(id: string) {
      if (goals.some(item => item.id === id)) setSelectedGoalId(id);
      setAdvice({ status: "closed" });
    },
    update(patch: GoalPatch) {
      if (!goal || !today) return;
      save(updateGoal(goal, patch, today));
    },
    setStatus(status: GoalStatus): string | null {
      if (!goal || !today) return "Not ready yet.";
      const result = setGoalStatus(goal, status, today);
      if (!result.ok) return result.reason;
      save(result.goal);
      return null;
    },
    reset(): string | null {
      if (!goal || !today) return "Not ready yet.";
      const result = resetGoal(goal, today);
      if (!result.ok) return result.reason;
      save(result.goal);
      setAdvice({ status: "closed" });
      return null;
    },
    setDeadline(date: ISODate | null) {
      if (!goal || !today) return;
      save(updateGoal(goal, { field: "deadline", value: date }, today));
    },
    requestAdvice() {
      setAdvice({ status: "loading" });
    },
  };

  return {
    scenarioState,
    sourceLabel: SOURCE_LABEL,
    isFixture: true,
    hydrated,
    goals,
    goal,
    activeGoal,
    activeForecast,
    valid,
    forecastResult,
    forecast,
    /** True while typed inputs have not reached the forecast yet. */
    pending: inputKey !== forecastKey,
    deadline,
    needsHelp,
    advice,
    narration: narration && narration.for === adviceResult ? narration.value.text : null,
    narrationSource: narration && narration.for === adviceResult ? narration.value.source : null,
    actions,
  };
}

export type BigPurchaseModel = ReturnType<typeof useBigPurchase>;

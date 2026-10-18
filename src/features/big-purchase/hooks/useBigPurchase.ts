"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useActiveCustomerId } from "@/components/layout/ActiveCustomer";
import { generateAdvice } from "../advice/generateAdvice";
import { narrateWithAi, type Narration } from "../ai/narrator";
import { ADVICE_SHIMMER_MS, INPUT_DEBOUNCE_MS } from "../config";
import { computeForecast, type ForecastGoal } from "../engine/forecast";
import { createGoal, goalStore, isGoalValid, resetGoal, setGoalStatus, updateGoal, withGoal, type GoalPatch } from "../state/goalStore";
import type { AdviceResult, Cents, Forecast, ForecastResult, Goal, GoalStatus, ISODate, Scenario } from "../types";

type AdviceState =
  | { status: "closed" }
  | { status: "loading" }
  | { status: "ready"; result: AdviceResult; deadline: ISODate | null; forecast: Forecast };

function newGoalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `goal-${Math.random().toString(36).slice(2)}`;
}

/** The active customer's goal against their Nessie scenario, loaded on the server. Goals stay in this browser. */
export function useBigPurchase(scenario: Scenario) {
  const customerId = useActiveCustomerId();
  // "today" is the scenario's as-of date, decided once on the server.
  const today = scenario.asOfDate;

  const stored = useSyncExternalStore(goalStore.subscribe, () => goalStore.getSnapshot(customerId), goalStore.getServerSnapshot);
  const goals = stored?.goals ?? [];
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const goal: Goal | null = goals.find(item => item.id === selectedGoalId)
    ?? goals.find(item => item.id === stored?.activeGoalId)
    ?? goals[0]
    ?? null;
  const hydrated = stored !== null;

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
    () => (forecastGoal ? computeForecast(scenario, forecastGoal) : null),
    [scenario, forecastGoal],
  );
  const forecast = forecastResult?.ok ? forecastResult.forecast : null;
  const activeGoal = goals.find(item => item.id === stored?.activeGoalId && item.status === "active") ?? null;
  const activeForecastResult = useMemo(() => {
    if (!activeGoal) return null;
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
    if (!adviceOpen || adviceFresh || !forecast || !forecastGoal) return;
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
    goalStore.set(customerId, withGoal(goalStore.getSnapshot(customerId), next));
  }, [customerId]);

  const actions = {
    startGoal(fields: { name: string; costCents: Cents; bufferCents: Cents }) {
      const next = createGoal(newGoalId(), today, fields);
      save(next);
      setSelectedGoalId(next.id);
    },
    selectGoal(id: string) {
      if (goals.some(item => item.id === id)) setSelectedGoalId(id);
      setAdvice({ status: "closed" });
    },
    update(patch: GoalPatch) {
      if (!goal) return;
      save(updateGoal(goal, patch, today));
    },
    setStatus(status: GoalStatus): string | null {
      if (!goal) return "Not ready yet.";
      const result = setGoalStatus(goal, status, today);
      if (!result.ok) return result.reason;
      save(result.goal);
      return null;
    },
    reset(): string | null {
      if (!goal) return "Not ready yet.";
      const result = resetGoal(goal, today);
      if (!result.ok) return result.reason;
      save(result.goal);
      setAdvice({ status: "closed" });
      return null;
    },
    setDeadline(date: ISODate | null) {
      if (!goal) return;
      save(updateGoal(goal, { field: "deadline", value: date }, today));
    },
    requestAdvice() {
      setAdvice({ status: "loading" });
    },
  };

  return {
    scenario,
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

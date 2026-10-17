"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Scenario } from "@/features/big-purchase/types";
import { weatherStage } from "@/features/calendar/engine/weatherStage";
import { purchaseStore } from "@/features/calendar/state/purchaseStore";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";

export function WeatherStageSync({ scenario, defaultCriticalBalanceCents }: {
  scenario: Scenario | null;
  defaultCriticalBalanceCents: number;
}) {
  const purchases = useSyncExternalStore(
    purchaseStore.subscribe,
    purchaseStore.getSnapshot,
    purchaseStore.getServerSnapshot,
  );
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents);
  const weather = useMemo(
    () => scenario ? weatherStage(scenario, purchases, criticalBalanceCents) : null,
    [scenario, purchases, criticalBalanceCents],
  );

  useEffect(() => {
    if (weather) document.body.dataset.weather = weather;
  }, [weather]);

  return null;
}

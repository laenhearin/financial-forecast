"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Scenario } from "@/features/big-purchase/types";
import { weatherStage } from "@/features/calendar/engine/weatherStage";
import { purchaseStore } from "@/features/calendar/state/purchaseStore";
import type { UserPurchase } from "@/features/calendar/types";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";
import { useActiveCustomer } from "./ActiveCustomer";

/** Lives in the layout, so it reads the shell's customer; with none loaded it shows the server's stage. */
const NO_PURCHASES: UserPurchase[] = [];

export function WeatherStageSync({ scenario, defaultCriticalBalanceCents }: {
  scenario: Scenario | null;
  defaultCriticalBalanceCents: number;
}) {
  const customerId = useActiveCustomer()?.id ?? null;
  const purchases = useSyncExternalStore(
    purchaseStore.subscribe,
    () => (customerId ? purchaseStore.getSnapshot(customerId) : NO_PURCHASES),
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

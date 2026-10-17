"use client";

import { useMemo, useSyncExternalStore } from "react";
import { addDays, daysBetween } from "@/lib/dates";
import type { Scenario } from "@/features/big-purchase/types";
import { ALL_ACCOUNTS } from "@/features/calendar/types";
import { buildCalendarModel, balanceOn } from "@/features/calendar/engine/model";
import { purchaseStore } from "@/features/calendar/state/purchaseStore";
import type { ProjectionPoint } from "./types";

/** Rebuild the home projection from the same saved calendar purchases as the calendar page. */
export function useCalendarAdjustedForecast(scenario: Scenario, baseProjection: ProjectionPoint[]) {
  const purchases = useSyncExternalStore(
    purchaseStore.subscribe,
    purchaseStore.getSnapshot,
    purchaseStore.getServerSnapshot,
  );
  const model = useMemo(
    () => buildCalendarModel(scenario, purchases, ALL_ACCOUNTS),
    [scenario, purchases],
  );

  const projection = useMemo(() => baseProjection.map((point) => ({
    ...point,
    balanceCents: balanceOn(model, addDays(scenario.asOfDate, point.day)) ?? point.balanceCents,
  })), [baseProjection, model, scenario.asOfDate]);

  return {
    projection,
    availableBalanceCents: projection[0]?.balanceCents ?? 0,
    balanceOnDate(date: string) {
      const day = daysBetween(scenario.asOfDate, date);
      return day >= 0 ? projection.find((point) => point.day === day)?.balanceCents ?? null : null;
    },
  };
}

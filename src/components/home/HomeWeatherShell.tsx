"use client";

import type { ReactNode } from "react";
import { balanceLevel } from "@/features/calendar/engine/balanceThresholds";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";
import type { Weather } from "./types";

export function HomeWeatherShell({ balanceCents, defaultCriticalBalanceCents, majorBillBalanceCents, children }: {
  balanceCents: number;
  defaultCriticalBalanceCents: number;
  majorBillBalanceCents?: number | null;
  children: ReactNode;
}) {
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents);
  const level = Math.max(balanceLevel(balanceCents, criticalBalanceCents), balanceLevel(majorBillBalanceCents ?? null, criticalBalanceCents));
  const weather: Weather = level >= 4 ? "downpour" : level >= 2 ? "rainy" : level === 1 ? "cloudy" : "sunny";
  return <div data-weather={weather} className="home-weather min-h-screen">{children}</div>;
}

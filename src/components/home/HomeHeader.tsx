"use client";

import { Cloud, CloudLightning, CloudRain, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { balanceLevel } from "@/features/calendar/engine/balanceThresholds";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";
import type { Weather } from "./types";

const CONDITIONS: Record<Weather, { icon: LucideIcon; label: string }> = {
  sunny: { icon: Sun, label: "Great balance outlook" },
  cloudy: { icon: Cloud, label: "Steady balance outlook" },
  rainy: { icon: CloudRain, label: "Low balance outlook" },
  downpour: { icon: CloudLightning, label: "Critical balance outlook" },
};

interface HomeHeaderProps {
  balanceCents: number;
  defaultCriticalBalanceCents: number;
  /** Day of the next tight spot, such as "Thursday"; null hides the second half of the status line. */
  nextStormLabel: string | null;
  className?: string;
}

export function HomeHeader({ balanceCents, defaultCriticalBalanceCents, nextStormLabel, className }: HomeHeaderProps) {
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents);
  const level = balanceLevel(balanceCents, criticalBalanceCents);
  const weather: Weather = level >= 4 ? "downpour" : level >= 2 ? "rainy" : level === 1 ? "cloudy" : "sunny";
  const { icon: TodayIcon, label } = CONDITIONS[weather];
  return (
    <div className={cn("text-center", className)}>
      <h1 className="mx-auto max-w-120 text-display font-medium text-balance text-primary">What do you want to know about your money?</h1>
      <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-body text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <TodayIcon aria-hidden className={cn("size-4", weather === "sunny" ? "text-sun" : weather === "downpour" ? "text-neg" : "text-rain")} strokeWidth={1.75} />
          {label}
        </span>
        {nextStormLabel && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <CloudRain aria-hidden className="size-4 text-rain" strokeWidth={1.75} />
              Rain on {nextStormLabel}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

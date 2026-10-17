"use client";

import { Cloud, CloudLightning, CloudRain, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/money";
import { balanceLevel } from "@/features/calendar/engine/balanceThresholds";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";
import type { Weather } from "./types";

const CONDITIONS: Record<Weather, { icon: LucideIcon; label: string }> = {
  sunny: { icon: Sun, label: "THRIVING BALANCE OUTLOOK" },
  cloudy: { icon: Cloud, label: "STABLE BALANCE OUTLOOK" },
  rainy: { icon: CloudRain, label: "CAUTION BALANCE OUTLOOK" },
  downpour: { icon: CloudLightning, label: "CRITICAL BALANCE OUTLOOK" },
};

interface HomeHeaderProps {
  userName: string;
  balanceCents: number;
  defaultCriticalBalanceCents: number;
  majorBillBalanceCents?: number | null;
  majorBillLabel?: string | null;
  /** Day of the next tight spot, such as "Thursday"; null hides the second half of the status line. */
  nextStormLabel: string | null;
  className?: string;
}

export function HomeHeader({ balanceCents, defaultCriticalBalanceCents, majorBillBalanceCents, majorBillLabel, nextStormLabel, userName, className }: HomeHeaderProps) {
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents);
  const billLevel = balanceLevel(majorBillBalanceCents ?? null, criticalBalanceCents);
  const level = Math.max(balanceLevel(balanceCents, criticalBalanceCents), billLevel);
  const weather: Weather = level >= 4 ? "downpour" : level >= 2 ? "rainy" : level === 1 ? "cloudy" : "sunny";
  const { icon: TodayIcon, label } = CONDITIONS[weather];
  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-3xl font-medium tracking-tight text-balance text-primary md:text-3xl 2xl:text-4xl">Welcome back, {userName}</h1>
      <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-body text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <TodayIcon aria-hidden className={cn("size-4", weather === "sunny" ? "text-sun" : weather === "downpour" ? "text-neg" : "text-rain")} strokeWidth={1.75} />
          {label}
        </span>
        {majorBillLabel && billLevel >= 2 && <><span aria-hidden>·</span><span>{billLevel >= 4 ? "CRITICAL" : "CAUTION"}: {majorBillLabel} will leave {formatUSD(majorBillBalanceCents ?? 0)}</span></>}
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

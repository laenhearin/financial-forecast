"use client";

import Link from "next/link";
import { CloudRain } from "lucide-react";
import { balanceLevel, defaultCriticalBalanceCents } from "@/features/calendar/engine/balanceThresholds";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";
import type { Scenario } from "@/features/big-purchase/types";
import { addDays, formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import type { HomeData } from "./types";

export function StormPreview({ homeData, scenario }: { homeData: HomeData; scenario: Scenario }) {
  const criticalCents = useCriticalBalance(defaultCriticalBalanceCents(scenario));
  const criticalDays = homeData.projection
    .filter(day => day.day > 0 && balanceLevel(day.balanceCents, criticalCents) >= 4)
    .sort((a, b) => a.day - b.day);

  return (
    <section aria-labelledby="storm-preview-title" className="flex min-w-0 flex-col gap-2 rounded-panel border border-app bg-card p-3">
      <div className="flex items-center justify-between">
        <h3 id="storm-preview-title" className="text-caption font-medium text-secondary"><Link href={ROUTES.stormSolver} className="hover:text-primary hover:underline">Storm solver</Link></h3>
      </div>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-micro font-medium text-secondary">Upcoming critical dates</h4>
        <span className="rounded-full bg-rain-soft px-2 py-0.5 text-micro text-secondary">{criticalDays.length}</span>
      </div>
      {criticalDays.length ? (
        <ul aria-label="All upcoming critical forecast dates" className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
          {criticalDays.map(day => {
            const date = addDays(homeData.asOfDate, day.day);
            const bills = homeData.markers.filter(marker => marker.day === day.day);
            return <li key={day.day} className="flex items-center gap-2 rounded-item border border-app bg-app weather-tile p-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rain-soft text-accent"><CloudRain aria-hidden className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <time dateTime={date} className="text-caption font-medium text-primary">{formatDate(date, "full")}</time>
                <p className="text-micro text-secondary">{bills.length ? bills.map(bill => bill.label).join(", ") : "Low projected balance"}</p>
              </div>
              <span className="shrink-0 text-caption font-semibold text-neg">{formatUSD(day.balanceCents)}</span>
            </li>;
          })}
        </ul>
      ) : <div className="flex flex-1 items-center justify-center rounded-item border border-dashed border-app bg-app weather-tile p-3 text-center text-caption text-secondary">No critical dates in the current forecast.</div>}
      <p className="text-micro text-secondary">Forecast balances at or below your {formatUSD(criticalCents)} critical threshold. Open Storm solver to review ways to prepare.</p>
    </section>
  );
}

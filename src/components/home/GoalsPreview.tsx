"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { computeForecast } from "@/features/big-purchase/engine/forecast";
import type { Goal, Scenario } from "@/features/big-purchase/types";
import { formatUSD } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { ROUTES } from "@/lib/navigation";

export function GoalsPreview({ goal, scenario }: { goal: Goal; scenario: Scenario }) {
  const result = useMemo(() => computeForecast(scenario, goal), [scenario, goal]);
  const plan = result.ok ? result.forecast.plan : null;
  const date = plan?.affordableDate;
  const initial = Array.from(goal.name.trim())[0]?.toLocaleUpperCase("en-US") ?? "G";

  return (
    <section aria-labelledby="goals-preview-title" className="flex min-w-0 flex-col gap-2 rounded-panel border border-app bg-card p-3">
      <div className="flex items-center justify-between">
        <h3 id="goals-preview-title" className="text-caption font-medium text-secondary">Goals</h3>
        <Link href={ROUTES.bigPurchase} aria-label="Manage purchase goal" className="rounded-item p-1 text-secondary hover:text-accent"><ArrowUpRight aria-hidden className="size-4" /></Link>
      </div>
      <Link href={ROUTES.bigPurchase} className="group flex items-center gap-3 rounded-item py-1">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-app bg-rain-soft text-xl font-semibold text-accent group-hover:border-accent-line">{initial}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lead font-semibold text-primary">{goal.name || "Your next goal"}</p>
          <p className="text-micro text-secondary">{goal.status === "active" ? "Active plan" : "Draft plan"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tracking-tight text-primary">{formatUSD(goal.costCents)}</p>
          <p className="text-micro text-secondary">{date ? (plan?.affordableNow ? "Affordable now" : formatDate(date, "short")) : "Not yet projected"}</p>
          <p className="text-[10px] text-secondary">Projected affordable date</p>
        </div>
      </Link>
      {[1, 2].map(slot => (
        <div key={slot} aria-label={`Additional goal slot ${slot}, coming soon`} className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-item border border-dashed border-app bg-app text-secondary">
          <Plus aria-hidden className="size-4 text-accent" />
          <span className="text-micro">More goals coming soon</span>
        </div>
      ))}
      <Link href={ROUTES.bigPurchase} className="jump-link self-end">Open Forecast Fund <ArrowRight aria-hidden className="size-4" /></Link>
    </section>
  );
}

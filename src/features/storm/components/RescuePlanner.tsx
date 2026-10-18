"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/features/big-purchase/types";
import { panelClass, panelTitleClass, subtitleClass } from "@/features/calendar/components/ui";
import type { UserPurchase } from "@/features/calendar/types";
import { CLEAR_OF_RAIN_CENTS, solveRescue, trimmableCategories, type DayOutlook, type DayWeather, type RescuePlan, type StormMetrics } from "../engine/rescue";

const WEATHER: Record<DayWeather, { icon: string; label: string; bg: string }> = {
  sunny: { icon: "☀️", label: "Sunny", bg: "bg-pos-soft" },
  cloudy: { icon: "⛅", label: "Cloudy", bg: "bg-accent-soft" },
  rainy: { icon: "🌧️", label: "Rainy", bg: "bg-rain-soft" },
  downpour: { icon: "⛈️", label: "Downpour", bg: "bg-neg-soft" },
};
const TIER_ICON = { gentle: "🌤️", balanced: "🌦️", aggressive: "🌈" } as const;
/** Essentials that start protected; the user can change this. */
const DEFAULT_PROTECTED = ["spending-groceries", "spending-gas", "spending-drugstores"];

const short = (date: string) => formatDate(date, "short");
const averageGap = (metrics: StormMetrics) => (metrics.days.length ? Math.round(metrics.gapCents / metrics.days.length) : 0);
const chipClass = "rounded-full border px-3 py-1.5 text-caption font-medium ui-transition";

/** Rescue plans from trimming everyday spending. A simulation: nothing is changed, paid, or moved. */
export function RescuePlanner({ scenario, purchases, criticalCents }: { scenario: Scenario; purchases: readonly UserPurchase[]; criticalCents: number }) {
  const categories = useMemo(() => trimmableCategories(scenario), [scenario]);
  const [protectedIds, setProtectedIds] = useState(() => new Set(DEFAULT_PROTECTED));
  const result = useMemo(
    () => solveRescue({ scenario, purchases, criticalCents, protectedIds }),
    [scenario, purchases, criticalCents, protectedIds],
  );
  const recommended = result.plans.find((plan) => plan.targetMet) ?? null;
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const selected = result.plans.find((p) => p.spec.tier === selectedTier) ?? recommended ?? result.plans[1] ?? result.plans[0] ?? null;
  const { baseline, storms } = result;

  function toggle(id: string) {
    setProtectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <section aria-labelledby="rescue-title" className={panelClass}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11.5 shrink-0 place-items-center rounded-panel bg-rain-soft text-2xl">🛟</span>
        <div>
          <h2 id="rescue-title" className={panelTitleClass}>Rescue plans</h2>
          <p className={subtitleClass}>Simulated fixes from trimming everyday spending. Nothing is changed, paid, or moved.</p>
        </div>
      </div>

      {storms.length === 0 ? (
        <p className="mt-4 rounded-item bg-pos-soft px-3 py-3 text-body text-primary">☀️ Clear skies: no storm days in the forecast at your {formatUSD(criticalCents)} critical balance.</p>
      ) : (
        <>
          <div className="mt-4 rounded-item border border-app p-4">
            <p className="text-body font-semibold text-primary">Storm report</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {storms.map((storm) => (
                <span key={storm.from} className={cn("rounded-full px-3 py-1 text-caption text-primary", WEATHER[storm.worst].bg)}>
                  {WEATHER[storm.worst].icon} {short(storm.from)}{storm.to !== storm.from ? ` – ${short(storm.to)}` : ""} · {WEATHER[storm.worst].label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-caption text-secondary">
              {baseline.stormDays} storm days ahead. Lowest projected balance {formatUSD(baseline.lowest.cents)} on {short(baseline.lowest.date)}.
            </p>
            {result.costOfInactionCents > 0 && (
              <p className="mt-1.5 text-body font-medium text-primary">
                If nothing changes, this storm could cost about {formatUSD(result.costOfInactionCents)} in overdraft fees
                <span className="text-caption font-normal text-secondary"> (typical $35 fee per overdrawn day with spending; check your bank).</span>
              </p>
            )}
          </div>

          <div className="mt-4">
            <p className="text-caption font-medium text-secondary">Protected categories (never trimmed). Tap to change:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = protectedIds.has(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)}
                    className={cn(chipClass, on ? "border-accent-line bg-accent-soft text-primary" : "border-app bg-card text-secondary hover:bg-nav-hover")}>
                    {on ? "🔒 " : ""}{c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {result.plans.map((plan) => (
              <PlanCard key={plan.spec.tier} plan={plan} baseline={baseline} selected={plan === selected} recommended={plan === recommended}
                onSelect={() => setSelectedTier(plan.spec.tier)} />
            ))}
          </div>
          {result.collapsed.length > 0 && (
            <p className="mt-2 text-caption text-secondary">{result.collapsed.join(" and ")} wouldn&apos;t add anything beyond the plan before it, so {result.collapsed.length === 1 ? "it's" : "they're"} hidden.</p>
          )}

          {selected && <PlanDetail plan={selected} baseline={baseline} criticalCents={criticalCents} />}
        </>
      )}
    </section>
  );
}

function PlanCard({ plan, baseline, selected, recommended, onSelect }: { plan: RescuePlan; baseline: StormMetrics; selected: boolean; recommended: boolean; onSelect: () => void }) {
  const drop = baseline.stormIndex > 0 ? Math.round(((baseline.stormIndex - plan.metrics.stormIndex) / baseline.stormIndex) * 100) : 0;
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={cn("ui-transition flex flex-col gap-2 rounded-item border p-4 text-left", selected ? "border-accent-line bg-accent-soft" : "border-app bg-card hover:bg-nav-hover")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-figure font-semibold text-primary"><span aria-hidden>{TIER_ICON[plan.spec.tier]} </span>{plan.spec.name}</span>
        {recommended && <span className="rounded-full bg-pos-soft px-2 py-1 text-micro font-medium text-primary">Recommended</span>}
        {!plan.targetMet && <span className="rounded-full bg-rain-soft px-2 py-1 text-micro font-medium text-primary">Best effort</span>}
      </div>
      <p className="text-caption text-secondary">Goal: {plan.spec.goal}. Trims up to {plan.spec.maxTrimPercent}%.</p>
      <p className="text-body text-primary">Storm days: <strong>{baseline.stormDays} → {plan.metrics.stormDays}</strong></p>
      <p className="text-caption text-secondary">Storm index {drop > 0 ? `−${drop}%` : "unchanged"}</p>
      <p className="text-caption text-secondary">Lowest balance {formatUSD(baseline.lowest.cents)} → {formatUSD(plan.metrics.lowest.cents)}</p>
      <p className="text-caption text-secondary">Average gap to a sunny day {formatUSD(averageGap(baseline))} → {formatUSD(averageGap(plan.metrics))}</p>
      <p className="text-caption text-secondary">{plan.trims.length} {plan.trims.length === 1 ? "trim" : "trims"} · You control every step</p>
    </button>
  );
}

function PlanDetail({ plan, baseline, criticalCents }: { plan: RescuePlan; baseline: StormMetrics; criticalCents: number }) {
  const weeklyTotal = plan.trims.reduce((sum, t) => sum + t.weeklyCents, 0);
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <WeatherStrip title="Before" days={baseline.days} />
        <WeatherStrip title={`After: ${plan.spec.name}`} days={plan.metrics.days} compare={baseline.days} />
      </div>

      <div>
        <p className="text-body font-semibold text-primary">What to do</p>
        {plan.trims.length === 0 ? (
          <p className="mt-2 text-caption text-secondary">No spending trim within this plan&apos;s limits helps. Try unprotecting a category, or see the ideas below.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {plan.trims.map((trim) => (
              <li key={trim.categoryId} className="rounded-item border border-app p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body font-medium text-primary">✂️ Trim {trim.label} by {trim.percent}%</p>
                  <span className="shrink-0 rounded-full bg-pos-soft px-2 py-1 text-micro font-medium text-primary">You control this</span>
                </div>
                <p className="mt-1 text-caption text-secondary">About {formatUSD(trim.weeklyCents)} less each week, across the forecast.</p>
              </li>
            ))}
          </ul>
        )}
        {weeklyTotal > 0 && <p className="mt-2 text-caption text-secondary">Together: about {formatUSD(weeklyTotal)} a week stays in your account.</p>}
        {!plan.targetMet && plan.cashNeeded && (
          <p className="mt-2 rounded-item bg-rain-soft px-3 py-2 text-caption text-primary">
            Best effort: your protected categories and this plan&apos;s limits leave some days in the rain. Keeping every day above {formatUSD(criticalCents + CLEAR_OF_RAIN_CENTS)} would take about {formatUSD(plan.cashNeeded.cents)} more by {short(plan.cashNeeded.byDate)}.
          </p>
        )}
      </div>

      <div>
        <p className="text-body font-semibold text-primary">Other ideas (advice only, not in the numbers above)</p>
        <ul className="mt-2 flex flex-col gap-2 text-caption text-secondary">
          <li className="rounded-item border border-app p-3"><span className="font-medium text-primary">⏸️ Pause savings contributions.</span> If you&apos;re saving toward a Forecast Fund goal, pausing contributions until the storm passes keeps more cash on hand. <Badge>You control this</Badge></li>
          <li className="rounded-item border border-app p-3"><span className="font-medium text-primary">📞 Call before the due date.</span> Many providers offer a short extension, a payment plan, or a one-time fee waiver if you ask before a payment is late. <Badge>Needs a yes from your provider</Badge></li>
          <li className="rounded-item border border-app p-3"><span className="font-medium text-primary">💵 Raise a little cash.</span> Sell something unused, return an unopened purchase, check for pending refunds, or pick up an extra shift. <Badge>Estimate</Badge></li>
          <li className="rounded-item border border-app p-3"><span className="font-medium text-primary">🤝 Ask for help if it&apos;s big.</span> Utility assistance programs, 211, and nonprofit credit counseling can help. Avoid payday loans and cash advances; they usually cost more than the bill.</li>
        </ul>
      </div>
      <p className="text-micro text-secondary">Forecast simulation based on your Nessie data and estimated spending. Paychecks are assumed to arrive as scheduled. This is educational, not professional financial advice.</p>
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="ml-1 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-micro font-medium text-primary">{children}</span>;
}

function WeatherStrip({ title, days, compare }: { title: string; days: readonly DayOutlook[]; compare?: readonly DayOutlook[] }) {
  const counts = days.reduce((acc, d) => ({ ...acc, [d.weather]: acc[d.weather] + 1 }), { sunny: 0, cloudy: 0, rainy: 0, downpour: 0 } as Record<DayWeather, number>);
  return (
    <div className="rounded-item border border-app p-3">
      <p className="text-body font-semibold text-primary">{title}</p>
      <p className="mt-0.5 text-micro text-secondary">
        {(Object.keys(WEATHER) as DayWeather[]).map((w) => `${WEATHER[w].icon} ${counts[w]} ${WEATHER[w].label.toLowerCase()}`).join(" · ")}
      </p>
      <ol className="mt-2 grid grid-cols-15 gap-1">
        {days.map((day, i) => {
          const changed = compare && compare[i]?.weather !== day.weather;
          return (
            <li key={day.date} title={`${short(day.date)}: ${WEATHER[day.weather].label}, ${formatUSD(day.cents)}${changed ? " (changed by your plan)" : ""}`}
              className={cn("grid aspect-square place-items-center rounded text-[0.7rem] leading-none", WEATHER[day.weather].bg, changed && "ring-2 ring-accent-line")}>
              <span aria-hidden>{WEATHER[day.weather].icon}</span>
              <span className="sr-only">{short(day.date)} {WEATHER[day.weather].label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

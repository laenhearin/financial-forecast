"use client";

import { useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, toUTCms } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import type { Forecast } from "../types";
import { chartRange, formatTick, msToISO } from "./chartAxis";
import { useChartAnimation } from "./motion";
import { cardClass, mutedTextClass } from "./ui";

interface Row { x: number; earmark: number; cash: number; percent: number }

/** Earmark step line rising to the cost, with optional cash-after-earmark and buffer lines. */
export function FundingChart({ forecast, costCents, bufferCents }: { forecast: Forecast; costCents: number; bufferCents: number }) {
  const range = chartRange(forecast);
  const rows: Row[] = forecast.days
    .filter(day => day.date <= range.end)
    .map(day => ({
      x: toUTCms(day.date),
      earmark: day.earmarkCents / 100,
      cash: day.spendableCents / 100,
      percent: Math.min(100, (day.earmarkCents * 100) / costCents),
    }));
  const peakCash = Math.max(...forecast.days.map(day => day.baseCents));
  const [showCash, setShowCash] = useState(peakCash <= costCents * 6);
  const animation = useChartAnimation();
  const affordable = forecast.plan.affordableDate;

  return (
    <section aria-labelledby="bp-funding-heading" className={`${cardClass} p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="bp-funding-heading" className="font-semibold">Set aside so far</h3>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={showCash} onChange={event => setShowCash(event.target.checked)} className="size-4 accent-(--bp-primary-ink)" />
          Show cash balance
        </label>
      </div>
      <div className="h-64" role="img" aria-label={affordable ? `Earmark rises to ${formatUSD(costCents)} by ${formatDate(affordable, "full")}.` : `Earmark toward ${formatUSD(costCents)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 24, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--bp-line)" vertical={false} />
            <XAxis dataKey="x" type="number" domain={range.domain} ticks={range.ticks} tickFormatter={formatTick} stroke="var(--bp-muted)" tickLine={false} fontSize={12} />
            <YAxis tickFormatter={v => formatUSD(Math.round(Number(v) * 100))} stroke="var(--bp-muted)" tickLine={false} axisLine={false} fontSize={12} width={72} />
            <Tooltip content={<FundingTooltip />} />
            {showCash && <Line dataKey="cash" type="stepAfter" stroke="var(--bp-sky)" strokeWidth={2} dot={false} name="Cash after earmark" {...animation} />}
            {showCash && <ReferenceLine y={bufferCents / 100} stroke="var(--bp-rose)" strokeWidth={2} strokeDasharray="2 5" label={{ value: "Buffer", position: "insideBottomLeft", fill: "var(--bp-danger-ink)", fontSize: 12 }} />}
            <ReferenceLine y={costCents / 100} stroke="var(--bp-ink)" strokeDasharray="6 6" label={{ value: `Cost ${formatUSD(costCents)}`, position: "insideTopLeft", fill: "var(--bp-ink)", fontSize: 12 }} />
            <Line dataKey="earmark" type="stepAfter" stroke="var(--bp-primary)" strokeWidth={3} dot={false} name="Earmark" {...animation} />
            {affordable && (
              <ReferenceDot x={toUTCms(affordable)} y={costCents / 100} r={6} fill="var(--bp-primary)" stroke="var(--bp-surface)" strokeWidth={2}
                label={{ value: `Affordable ${formatDate(affordable, "short")}`, position: "top", fill: "var(--bp-primary-ink)", fontSize: 12, fontWeight: 600 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function FundingTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-(--bp-radius-control) border border-(--bp-line) bg-(--bp-surface) px-3 py-2 text-sm shadow-(--bp-shadow-card)">
      <p className="font-semibold">{formatDate(msToISO(row.x), "full")}</p>
      <p>Earmarked: {formatUSD(Math.round(row.earmark * 100))}</p>
      <p className={mutedTextClass}>{Math.round(row.percent)}% funded</p>
    </div>
  );
}

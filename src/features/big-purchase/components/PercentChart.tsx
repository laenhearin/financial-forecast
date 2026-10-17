"use client";

import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, toUTCms } from "@/lib/dates";
import type { Forecast } from "../types";
import { chartRange, formatTick, msToISO } from "./chartAxis";
import { useChartAnimation } from "./motion";
import { cardClass } from "./ui";

const MILESTONES = [25, 50, 75, 100];

/** Percent funded on a fixed 0 to 100% axis, with dots where it crosses each quarter. */
export function PercentChart({ forecast }: { forecast: Forecast }) {
  const range = chartRange(forecast);
  const rows = forecast.funding.map(point => ({ x: toUTCms(point.date), percent: point.percentFunded }));
  const animation = useChartAnimation();
  const milestones = MILESTONES.flatMap(target => {
    const after = rows.findIndex(row => row.percent >= target);
    if (after <= 0) return [];
    const before = rows[after - 1];
    const share = (target - before.percent) / (rows[after].percent - before.percent);
    return [{ target, x: before.x + share * (rows[after].x - before.x) }];
  });

  return (
    <section aria-labelledby="bp-percent-heading" className={`${cardClass} p-6`}>
      <h3 id="bp-percent-heading" className="mb-4 font-semibold">Percent funded</h3>
      <div className="h-48" role="img" aria-label={`Percent funded climbs from 0% to ${Math.round(rows.at(-1)?.percent ?? 0)}%.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 12, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="bp-percent-fill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="var(--bp-mint)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="var(--bp-sky)" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--bp-line)" vertical={false} />
            <XAxis dataKey="x" type="number" domain={range.domain} ticks={range.ticks} tickFormatter={formatTick} stroke="var(--bp-muted)" tickLine={false} fontSize={12} allowDataOverflow />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} stroke="var(--bp-muted)" tickLine={false} axisLine={false} fontSize={12} width={72} />
            <Tooltip
              formatter={value => [`${Math.round(Number(value))}%`, "Funded"]}
              labelFormatter={label => formatDate(msToISO(Number(label)), "full")}
              contentStyle={{ borderRadius: 12, borderColor: "var(--bp-line)", color: "var(--bp-ink)" }}
            />
            <Area dataKey="percent" type="monotone" stroke="var(--bp-primary-ink)" strokeWidth={2} fill="url(#bp-percent-fill)" {...animation} />
            {milestones.map(m => (
              <ReferenceDot key={m.target} x={m.x} y={m.target} r={5} fill="var(--bp-surface)" stroke="var(--bp-primary-ink)" strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

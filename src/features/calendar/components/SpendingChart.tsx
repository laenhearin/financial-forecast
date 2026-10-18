"use client";

import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES } from "../engine/grid";
import type { CalendarModel } from "../engine/model";
import { WEEK_CHART, monthlySpending, weekChartPoints, weeklySpending } from "../engine/weekly";
import type { ISODate } from "../types";
import { inputClass, noteClass, panelClass, panelTitleClass, subtitleClass } from "./ui";

/** Daily spending in the selected week or displayed calendar month, using the same account view. */
export function SpendingChart({ model, selected, month }: { model: CalendarModel; selected: ISODate; month: ISODate }) {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const monthly = period === "monthly";
  const days = monthly ? monthlySpending(model, month) : weeklySpending(model, selected);
  const { points, scaleMaxCents } = weekChartPoints(days);
  const { width, height, left, right, top, bottom, gridLines } = WEEK_CHART;
  const plotHeight = height - top - bottom;
  // Beyond the forecast window, leave a gap rather than implying $0 of spending.
  const available = points.filter(point => point.date <= model.forecastEnd);
  const totalCents = available.reduce((sum, d) => sum + d.spendingCents, 0);
  const range = `${formatDate(days[0].date, "short")} – ${formatDate(days.at(-1)!.date, "full")}`;
  const description = `${monthly ? "Monthly" : "Weekly"} spending ${range}: ${available.map(p => `${formatDate(p.date, "short")} ${formatUSD(p.spendingCents)}`).join(", ") || "No forecast available"}. Total available spending ${formatUSD(totalCents)}.`;

  return (
    <section aria-labelledby="spending-chart-title" className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="spending-chart-title" className={panelTitleClass}>{monthly ? "Monthly spending" : "Weekly spending"}</h2>
          <p className={subtitleClass}>{range}</p>
        </div>
        <label className="flex flex-col gap-1 text-micro text-secondary">
          Graph range
          <select value={period} onChange={event => setPeriod(event.target.value === "monthly" ? "monthly" : "weekly")} className={cn(inputClass, "w-auto min-w-28")}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-micro text-secondary">{monthly ? "Showing the selected calendar month. Select a date or use the calendar arrows to change it." : "Showing the week of your selected date. Select another day to explore its week."}</p>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description} className="mt-4 block h-auto w-full overflow-visible">
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = top + (plotHeight * i) / gridLines;
          return (
            <g key={i}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="stroke-app" strokeWidth={1} />
              <text x={left - 9} y={y + 4} textAnchor="end" className="fill-secondary text-[18px] sm:text-micro">
                ${Math.round((scaleMaxCents * (1 - i / gridLines)) / 100)}
              </text>
            </g>
          );
        })}
        <path
          d={available.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")}
          fill="none"
          className="stroke-accent"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const isToday = p.date === model.asOfDate;
          const hasData = p.date <= model.forecastEnd;
          const dayNumber = Number(p.date.slice(8));
          const showTick = !monthly || i === 0 || (dayNumber % 5 === 0 && i < points.length - 3) || i === points.length - 1;
          return (
            <g key={p.date}>
              {hasData && <circle cx={p.x} cy={p.y} r={isToday ? 6 : monthly ? 3 : 4.5} className={isToday ? "fill-accent stroke-card" : "fill-card stroke-accent"} strokeWidth={monthly ? 2 : 3}>
                <title>{`${formatDate(p.date, "full")}: ${formatUSD(p.spendingCents)}${isToday ? " (today)" : ""}`}</title>
              </circle>}
              {hasData && !monthly && <text x={p.x} y={Math.max(top - 5, p.y - 11)} textAnchor="middle" className="fill-primary text-micro font-semibold">
                {formatUSD(p.spendingCents)}
              </text>}
              {showTick && <text x={p.x} y={height - 12} textAnchor="middle" className={cn("text-[18px] sm:text-micro", isToday ? "fill-primary font-semibold" : "fill-secondary")}>
                {monthly ? dayNumber : WEEKDAY_NAMES[i]}
              </text>}
            </g>
          );
        })}
      </svg>

      <p className="mt-2.5 text-caption text-secondary">
        {available.length ? `Total spending this ${monthly ? "month" : "week"}: ` : "Spending total: "}<strong className="font-semibold text-primary">{available.length ? formatUSD(totalCents) : "Unavailable"}</strong>
      </p>
      {available.length < days.length && <p className={noteClass}>The forecast ends {formatDate(model.forecastEnd, "full")}. Later dates are blank and excluded from the total.</p>}
      <p className={noteClass}>
        Past dates show recorded payments and saved purchases. Future dates include bills, planned costs, estimated everyday spending and purchases. Incoming money is not counted here.
      </p>
    </section>
  );
}

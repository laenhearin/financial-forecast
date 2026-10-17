import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES } from "../engine/grid";
import type { CalendarModel } from "../engine/model";
import { WEEK_CHART, weekChartPoints, weeklySpending } from "../engine/weekly";
import type { ISODate } from "../types";
import { noteClass, panelClass, panelTitleClass, subtitleClass } from "./ui";

/** Money going out each day of the selected week, as a hand-drawn SVG line chart. */
export function WeeklySpendingChart({ model, selected }: { model: CalendarModel; selected: ISODate }) {
  const days = weeklySpending(model, selected);
  const { points, scaleMaxCents } = weekChartPoints(days);
  const { width, height, left, right, top, bottom, gridLines } = WEEK_CHART;
  const plotHeight = height - top - bottom;
  const totalCents = days.reduce((sum, d) => sum + d.spendingCents, 0);
  const range = `${formatDate(days[0].date, "short")} – ${formatDate(days[6].date, "short")}`;
  const description = `Spending ${range}: ${points.map((p, i) => `${WEEKDAY_NAMES[i]} ${formatUSD(p.spendingCents)}`).join(", ")}. Total ${formatUSD(totalCents)}.`;

  return (
    <section aria-labelledby="weekly-title" className={panelClass}>
      <h2 id="weekly-title" className={panelTitleClass}>
        Weekly spending
      </h2>
      <p className={subtitleClass}>{range}</p>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description} className="mt-4 block h-auto w-full overflow-visible">
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = top + (plotHeight * i) / gridLines;
          return (
            <g key={i}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="stroke-app" strokeWidth={1} />
              <text x={left - 9} y={y + 4} textAnchor="end" className="fill-secondary text-micro">
                ${Math.round((scaleMaxCents * (1 - i / gridLines)) / 100)}
              </text>
            </g>
          );
        })}
        <path
          d={points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")}
          fill="none"
          className="stroke-accent"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const isToday = p.date === model.asOfDate;
          return (
            <g key={p.date}>
              <circle cx={p.x} cy={p.y} r={isToday ? 6 : 4.5} className={isToday ? "fill-accent stroke-card" : "fill-card stroke-accent"} strokeWidth={3}>
                <title>{`${WEEKDAY_NAMES[i]}: ${formatUSD(p.spendingCents)}${isToday ? " (today)" : ""}`}</title>
              </circle>
              <text x={p.x} y={Math.max(top - 5, p.y - 11)} textAnchor="middle" className="fill-primary text-micro font-semibold">
                {formatUSD(p.spendingCents)}
              </text>
              <text x={p.x} y={height - 12} textAnchor="middle" className={cn("text-micro", isToday ? "fill-primary font-semibold" : "fill-secondary")}>
                {WEEKDAY_NAMES[i]}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-2.5 text-caption text-secondary">
        Total spending this week: <strong className="font-semibold text-primary">{formatUSD(totalCents)}</strong>
      </p>
      <p className={noteClass}>
        Bills, planned costs, estimated everyday spending and your purchases count as spending. Incoming money raises the forecast but is not counted here.
      </p>
    </section>
  );
}

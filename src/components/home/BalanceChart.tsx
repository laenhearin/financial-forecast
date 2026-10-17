"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { riskLevel } from "@/features/calendar/engine/model";
import { forecastDate, forecastDays, weeklyCurve } from "./weeklyForecast";
import type { BillMarker, ProjectionPoint } from "./types";

interface BalanceChartProps {
  asOfDate: string;
  availableBalanceCents: number;
  projection: ProjectionPoint[];
  markers: BillMarker[];
  isSampleData?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function BalanceChart({ asOfDate, availableBalanceCents, projection, markers, isSampleData = false, isLoading = false, className }: BalanceChartProps) {
  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState(0);
  const id = useId();
  const days = forecastDays(projection, availableBalanceCents);
  const lastWeek = Math.max(0, Math.ceil(days.length / 7) - 1);
  const currentWeek = Math.min(week, lastWeek);
  const visible = days.slice(currentWeek * 7, currentWeek * 7 + 7);
  const active = Math.min(selected, Math.max(0, visible.length - 1));
  const curve = weeklyCurve(visible);
  const selectedDay = visible[active];
  const selectedPoint = curve.points[active];

  function changeWeek(offset: number) {
    setWeek(Math.max(0, Math.min(lastWeek, currentWeek + offset)));
    setSelected(0);
  }

  if (isLoading) return <div aria-busy="true" aria-label="Loading forecast" className={className}><div className="h-80 animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" /></div>;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium text-primary">
          <CloudSun aria-hidden className="size-6 text-accent" />Your money forecast
        </h2>
        <Link href={ROUTES.calendar} className="jump-link">Open full calendar <ArrowRight aria-hidden className="size-4" /></Link>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-medium tracking-tight text-primary md:text-4xl">{formatUSD(availableBalanceCents)}</p>
          <p className="mt-2 text-body text-secondary">Available balance</p>
        </div>
        <div className="text-right">
          {isSampleData && <span className="rounded-full border border-app bg-card px-3 py-1 text-micro text-secondary">Sample data</span>}
          <p className="mt-2 text-caption text-secondary">{days.length}-day outlook · USD</p>
        </div>
      </div>
      {selectedDay ? <>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-caption text-secondary" aria-live="polite">{forecastDate(asOfDate, visible[0].day).label}–{forecastDate(asOfDate, visible.at(-1)!.day).label} · projected balances</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => changeWeek(-1)} disabled={currentWeek === 0} aria-label="Previous forecast week" className="rounded-item border border-app bg-card p-2 text-primary disabled:opacity-35"><ChevronLeft aria-hidden className="size-4" /></button>
            <button type="button" onClick={() => changeWeek(1)} disabled={currentWeek === lastWeek} aria-label="Next forecast week" className="rounded-item border border-app bg-card p-2 text-primary disabled:opacity-35"><ChevronRight aria-hidden className="size-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto pb-2" role="region" aria-label="Daily forecast chart and cards" tabIndex={0}>
          <div className="min-w-140">
            <svg viewBox="0 0 700 200" role="img" aria-labelledby={`${id}-title ${id}-description`} className="block h-auto w-full overflow-visible">
              <title id={`${id}-title`}>Seven-day balance forecast</title>
              <desc id={`${id}-description`}>Projected balances, not recorded transactions. Select a day below for its balance and daily change. The vertical scale fits the visible balances.</desc>
              <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ac)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--ac)" stopOpacity="0.03" /></linearGradient></defs>
              <path d={curve.area} fill={`url(#${id}-fill)`} />
              <path d={curve.line} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
              {curve.points.map((point, index) => <circle key={visible[index].day} cx={point.x} cy={point.y} r={index === active ? 6 : 4} className="fill-card stroke-accent" strokeWidth={index === active ? 3 : 2} />)}
              {selectedPoint && <g>
                <rect x={selectedPoint.x - 47} y={selectedPoint.y - 34} width="94" height="24" rx="12" fill="var(--card)" />
                <text x={selectedPoint.x} y={selectedPoint.y - 18} textAnchor="middle" className="fill-primary" fontSize="12" fontWeight="600">{formatUSD(selectedDay.balanceCents)}</text>
              </g>}
            </svg>
            <div className="grid grid-cols-7 gap-1.5">
              {visible.map((day, index) => {
                const date = forecastDate(asOfDate, day.day);
                const risk = riskLevel(day.balanceCents, availableBalanceCents);
                const Icon = risk >= 4 ? CloudLightning : risk >= 2 ? CloudRain : risk === 1 ? CloudSun : Sun;
                const outlook = risk >= 4 ? "Critical balance" : risk >= 2 ? "Low balance" : risk === 1 ? "Caution" : "Comfortable balance";
                const bills = markers.filter((marker) => marker.day === day.day);
                return <button type="button" key={day.day} onClick={() => setSelected(index)} aria-pressed={index === active} className={cn("flex min-w-0 flex-col items-center rounded-2xl border px-1 py-3 text-center transition-colors", index === active ? "border-accent-line bg-card ring-1 ring-accent" : "border-transparent bg-card/65 hover:bg-card")}>
                  <span className="text-xs font-semibold tracking-tight text-primary 2xl:text-sm">{formatUSD(day.balanceCents)}</span>
                  <Icon aria-hidden className={cn("my-3 size-8", risk === 0 ? "text-sun" : risk >= 4 ? "text-neg" : "text-accent")} strokeWidth={1.5} />
                  <span className="sr-only">{outlook}. </span>
                  <span className="text-micro text-secondary">net <span className={day.netCents < 0 ? "text-neg" : day.netCents > 0 ? "text-pos" : "text-secondary"}>{day.netCents > 0 ? "+" : ""}{formatUSD(day.netCents)}</span></span>
                  <span className="mt-3 text-caption font-semibold text-primary">{date.weekday}</span>
                  <time dateTime={date.date} className="mt-1 text-micro text-secondary">{date.label}</time>
                  {bills.length > 0 && <span className="mt-2 text-micro text-secondary">{bills.map((bill) => bill.label).join(", ")}</span>}
                </button>;
              })}
            </div>
          </div>
        </div>
        <p className="mt-3 text-micro text-secondary">Weather reflects balance risk. Net is the change from the previous day.</p>
      </> : <p className="mt-8 text-body text-secondary">No projected balance is available.</p>}
    </div>
  );
}

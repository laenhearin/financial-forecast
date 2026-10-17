"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Cloud, CloudRain, CloudSun, Sun } from "lucide-react";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dates";
import { dailyWeather, forecastDate, forecastDays, weeklyCurve } from "./weeklyForecast";
import type { BillMarker, ProjectionPoint } from "./types";

interface BalanceChartProps {
  asOfDate: string;
  todayNetCents: number;
  availableBalanceCents: number;
  projection: ProjectionPoint[];
  markers: BillMarker[];
  monthlyTotals: { incomeCents: number; spendingCents: number };
  isLoading?: boolean;
  className?: string;
}

export function BalanceChart({ asOfDate, todayNetCents, availableBalanceCents, projection, markers, monthlyTotals, isLoading = false, className }: BalanceChartProps) {
  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState(0);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const id = useId();
  const days = forecastDays(projection, availableBalanceCents, todayNetCents);
  const lastWeek = Math.max(0, Math.ceil(days.length / 7) - 1);
  const currentWeek = Math.min(week, lastWeek);
  const visible = days.slice(currentWeek * 7, currentWeek * 7 + 7);
  const active = Math.min(selected, Math.max(0, visible.length - 1));
  const curve = weeklyCurve(visible);
  const selectedDay = visible[active];
  const selectedPoint = curve.points[active];
  const high = Math.max(...visible.map(day => day.balanceCents));
  const low = Math.min(...visible.map(day => day.balanceCents));

  function changeWeek(offset: number) {
    setWeek(Math.max(0, Math.min(lastWeek, currentWeek + offset)));
    setSelected(0);
    setTooltipVisible(false);
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
      <div className="mt-5 grid items-end gap-5 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-5xl font-light tracking-tight text-primary 2xl:text-6xl">{formatUSD(availableBalanceCents)}</p>
          <p className="mt-2 text-body text-secondary">Available balance</p>
        </div>
        <div className="sm:border-l sm:border-app sm:pl-4">
          <p className="text-caption text-secondary">Income this month</p>
          <p className="mt-2 text-xl font-medium text-primary">{formatUSD(monthlyTotals.incomeCents)}</p>
        </div>
        <div className="sm:border-l sm:border-app sm:pl-4">
          <p className="text-caption text-secondary">Spending this month</p>
          <p className="mt-2 text-xl font-medium text-primary">{formatUSD(monthlyTotals.spendingCents)}</p>
        </div>
      </div>
      {selectedDay ? <>
        <div className="mt-2 flex items-center justify-end gap-3">
          <div className="flex gap-1">
            <button type="button" onClick={() => changeWeek(-1)} disabled={currentWeek === 0} aria-label="Previous forecast week" className="rounded-item border border-app bg-card p-2 text-primary disabled:opacity-35"><ChevronLeft aria-hidden className="size-4" /></button>
            <button type="button" onClick={() => changeWeek(1)} disabled={currentWeek === lastWeek} aria-label="Next forecast week" className="rounded-item border border-app bg-card p-2 text-primary disabled:opacity-35"><ChevronRight aria-hidden className="size-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto pb-2" role="region" aria-label="Daily forecast chart and cards" tabIndex={0}>
          <div className="min-w-140">
            <svg viewBox="0 0 700 230" role="group" aria-labelledby={`${id}-title ${id}-description`} className="block h-auto w-full overflow-visible">
              <title id={`${id}-title`}>Seven-day balance forecast</title>
              <desc id={`${id}-description`}>Projected balances, not recorded transactions. Select a day below for its balance and daily change. The vertical scale fits the visible balances.</desc>
              <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ac)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--ac)" stopOpacity="0.03" /></linearGradient></defs>
              <g className="stroke-app" strokeWidth="1">
                <path d="M 2 25 V 200 H 698" fill="none" />
                <path d="M 2 40 H 698 M 2 140 H 698" strokeDasharray="3 5" opacity="0.6" />
              </g>
              <g className="fill-secondary" fontSize="10">
                <text x="2" y="15">Balance (USD)</text>
                <text x="4" y={high === low ? 96 : 36}>{formatUSD(high)}</text>
                {high !== low && <text x="4" y="154">{formatUSD(low)}</text>}
                <text x="350" y="221" textAnchor="middle">Date</text>
              </g>
              <path d={curve.area} fill={`url(#${id}-fill)`} />
              <path d={curve.line} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
              {curve.points.map((point, index) => {
                const day = visible[index];
                const change = day.netCents === 0 ? "" : `, ${day.netCents > 0 ? "+" : ""}${formatUSD(day.netCents)} from previous day`;
                return <g key={day.day}>
                  <circle cx={point.x} cy={point.y} r={tooltipVisible && index === active ? 6 : 4} className="fill-card stroke-accent" strokeWidth={tooltipVisible && index === active ? 3 : 2} />
                  <circle cx={point.x} cy={point.y} r="30" fill="transparent" tabIndex={0} role="button"
                    aria-label={`${forecastDate(asOfDate, day.day).label}: ${formatUSD(day.balanceCents)}${change}`}
                    onPointerEnter={() => { setSelected(index); setTooltipVisible(true); }}
                    onPointerLeave={() => setTooltipVisible(false)}
                    onFocus={() => { setSelected(index); setTooltipVisible(true); }}
                    onBlur={() => setTooltipVisible(false)}
                    onClick={() => { setSelected(index); setTooltipVisible(true); }}
                    onKeyDown={event => { if (event.key === "Escape") setTooltipVisible(false); if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(index); setTooltipVisible(true); } }}
                    className="cursor-pointer" />
                </g>;
              })}
              {tooltipVisible && selectedPoint && <g pointerEvents="none" transform={`translate(${Math.max(100, Math.min(600, selectedPoint.x))}, ${Math.max(2, selectedPoint.y - (selectedDay.netCents === 0 ? 62 : 80))})`}>
                <g key={selectedDay.day} className="forecast-tooltip-enter">
                <rect x="-98" width="196" height={selectedDay.netCents === 0 ? 49 : 67} rx="10" fill="var(--card)" stroke="var(--bd)" />
                <text y="17" textAnchor="middle" className="fill-secondary" fontSize="10">{formatDate(forecastDate(asOfDate, selectedDay.day).date, "full")}</text>
                <text y="35" textAnchor="middle" className="fill-primary" fontSize="13" fontWeight="600">{formatUSD(selectedDay.balanceCents)}</text>
                {selectedDay.netCents !== 0 && <text y="53" textAnchor="middle" className="fill-secondary" fontSize="10">{`${selectedDay.netCents > 0 ? "+" : ""}${formatUSD(selectedDay.netCents)} from previous day`}</text>}
                </g>
              </g>}
            </svg>
            <div className="grid grid-cols-7 gap-1.5">
              {visible.map((day, index) => {
                const date = forecastDate(asOfDate, day.day);
                const bills = markers.filter((marker) => marker.day === day.day);
                const weather = dailyWeather(day.netCents, bills.length > 0);
                const Icon = weather === "sunny" ? Sun : weather === "rainy" ? CloudRain : Cloud;
                const outlook = weather === "sunny" ? "Steady or gaining money" : weather === "rainy" ? "Bill day or large loss" : "Losing money";
                return <button type="button" key={day.day} data-day-weather={weather}
                  onPointerEnter={() => { setSelected(index); setTooltipVisible(true); }}
                  onPointerLeave={() => setTooltipVisible(false)}
                  onFocus={() => { setSelected(index); setTooltipVisible(true); }}
                  onBlur={() => setTooltipVisible(false)}
                  onKeyDown={event => { if (event.key === "Escape") setTooltipVisible(false); }}
                  onClick={() => { setSelected(index); setTooltipVisible(true); }}
                  aria-pressed={tooltipVisible && index === active} className={cn("flex min-w-0 flex-col items-center rounded-2xl border px-1 py-3 text-center transition-colors", tooltipVisible && index === active ? "border-accent-line bg-card ring-1 ring-accent" : "border-transparent bg-card/65 hover:bg-card")}>
                  <span className="text-xs font-semibold tracking-tight text-primary 2xl:text-sm">{formatUSD(day.balanceCents)}</span>
                  <Icon aria-hidden className={cn("my-3 size-8", weather === "sunny" ? "text-sun" : "text-accent")} strokeWidth={1.5} />
                  <span className="sr-only">{outlook}. </span>
                  <span className="text-micro text-secondary">net <span className={day.netCents < 0 ? "text-neg" : day.netCents > 0 ? "text-pos" : "text-secondary"}>{day.netCents > 0 ? "+" : ""}{formatUSD(day.netCents)}</span></span>
                  <span className="mt-3 text-caption font-semibold text-primary">{day.day === 0 ? "TODAY" : date.weekday}</span>
                  <time dateTime={date.date} className="mt-1 text-micro text-secondary">{date.label}</time>
                  {bills.length > 0 && <span className="mt-2 text-micro text-secondary">{bills.map((bill) => bill.label).join(", ")}</span>}
                </button>;
              })}
            </div>
          </div>
        </div>
        <p className="mt-3 text-micro text-secondary">Sunny: net $0 or a gain. Cloudy: a loss. Rain: a loss of $100+ or a bill day with a net loss.</p>
      </> : <p className="mt-8 text-body text-secondary">No projected balance is available.</p>}
    </div>
  );
}

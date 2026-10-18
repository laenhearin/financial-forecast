import { daysBetween } from "../dates";
import type { BalancePoint } from "./types";
export function linearScale(
  min: number,
  max: number,
  from: number,
  to: number,
) {
  return (value: number) =>
    max === min
      ? (from + to) / 2
      : from + ((value - min) / (max - min)) * (to - from);
}
export function axisTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    min -= 100;
    max += 100;
  }
  return Array.from({ length: count }, (_, index) =>
    Math.round(min + ((max - min) * index) / (count - 1)),
  );
}
export function sampleIndices(length: number, count = 6): number[] {
  if (length === 0) return [];
  return [
    ...new Set(
      Array.from({ length: Math.min(count, length) }, (_, i) =>
        Math.round(
          (i * (length - 1)) / Math.max(1, Math.min(count, length) - 1),
        ),
      ),
    ),
  ];
}
export function lineGeometry(
  points: BalancePoint[],
  bufferCents: number,
  width = 510,
  height = 250,
) {
  const values = points.map((p) => p.balanceCents);
  const ticks = axisTicks(
    Math.min(bufferCents, ...values),
    Math.max(bufferCents, ...values),
  );
  const y = linearScale(ticks[0], ticks.at(-1)!, height - 30, 15);
  const first = points[0]?.date;
  const span = first ? daysBetween(first, points.at(-1)!.date) : 0;
  const x = (date: string) =>
    linearScale(0, span, 70, width - 15)(first ? daysBetween(first, date) : 0);
  const path = (rows: BalancePoint[]) =>
    rows
      .map((p, i) => `${i ? "L" : "M"} ${x(p.date)} ${y(p.balanceCents)}`)
      .join(" ");
  const actual = points.filter((p) => !p.isForecast);
  const future = points.filter((p) => p.isForecast);
  if (actual.length && future.length) future.unshift(actual.at(-1)!);
  const min = points.reduce<BalancePoint | undefined>(
    (low, p) => (!low || p.balanceCents < low.balanceCents ? p : low),
    undefined,
  );
  return {
    x,
    y,
    ticks,
    actual: path(actual),
    forecast: path(future),
    minimum: min,
  };
}
/** Closed ring sector, with the full circle split into two SVG arcs. Angles in radians. */
export function donutArc(
  start: number,
  end: number,
  outer = 75,
  inner = 45,
  cx = 90,
  cy = 95,
): string {
  if (end <= start) return "";
  if (end - start >= Math.PI * 2 - 1e-8)
    return `${donutArc(start, start + Math.PI, outer, inner, cx, cy)} ${donutArc(start + Math.PI, end - 1e-10, outer, inner, cx, cy)}`;
  const point = (r: number, a: number) =>
    `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${point(outer, start)} A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)} L ${point(inner, end)} A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)} Z`;
}
export function donutSlices(amounts: number[]) {
  const total = amounts.reduce((sum, value) => sum + value, 0);
  let angle = -Math.PI / 2;
  return amounts.map((value) => {
    const start = angle;
    angle += total > 0 ? (value / total) * Math.PI * 2 : 0;
    return { start, end: angle, path: donutArc(start, angle) };
  });
}
export function barRect(
  value: number,
  maximum: number,
  index: number,
  count: number,
  series: number,
) {
  const group = 440 / Math.max(count, 1),
    width = Math.min(22, group * 0.32);
  const height = maximum > 0 ? Math.max(0, (value / maximum) * 170) : 0;
  return {
    x: 65 + group * index + group / 2 + (series === 0 ? -width : 1),
    y: 190 - height,
    width,
    height,
  };
}

import { formatUSD } from "../../lib/money";
import type { BillMarker, ProjectionPoint } from "./types";

/** SVG user units. The chart renders at 1:1 in the 640px-wide Home column. */
export const CHART = {
  width: 640,
  height: 200,
  /** Space above the highest balance. */
  topPadding: 24,
  /** Bottom of the plot area, where the baseline is drawn. */
  baselineY: 176,
  /** Top edge of the "Today" / "Day 30" labels. */
  xLabelY: 184,
  markerRadius: 5,
  /** Distance from a marker's center to the top of its label. */
  markerLabelOffset: 20,
  labelFontSize: 12,
  /** Minimum space between the line and a label below it. */
  labelLineGap: 4,
  maxMarkers: 2,
  /** The domain bottom sits this fraction of (max - min) below the lowest balance. */
  bottomRoom: 0.65,
} as const;

export type LabelAnchor = "start" | "middle" | "end";

export interface MarkerLayout {
  day: number;
  label: string;
  cx: number;
  cy: number;
  labelX: number;
  /** Top edge of the label (rendered with a hanging baseline). */
  labelY: number;
  anchor: LabelAnchor;
}

export interface ChartLayout {
  linePath: string;
  areaPath: string;
  markers: MarkerLayout[];
  lastDay: number;
}

interface Point {
  x: number;
  y: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Rough width of a label; slightly generous so edge clamping and collision checks stay safe. */
export function estimateLabelWidth(label: string, fontSize: number = CHART.labelFontSize): number {
  return label.length * fontSize * 0.58;
}

/** Line height at x, interpolated between neighboring points. */
function lineYAt(points: readonly Point[], x: number): number {
  if (x <= points[0].x) return points[0].y;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.x) return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return points[points.length - 1].y;
}

/** Lowest on-screen point of the line (largest y) between two x positions. */
function lowestLineYBetween(points: readonly Point[], left: number, right: number): number {
  let lowest = Math.max(lineYAt(points, left), lineYAt(points, right));
  for (const p of points) if (p.x > left && p.x < right) lowest = Math.max(lowest, p.y);
  return lowest;
}

export function layoutBalanceChart(projection: readonly ProjectionPoint[], markers: readonly BillMarker[]): ChartLayout {
  const sorted = [...projection].sort((a, b) => a.day - b.day);
  if (sorted.length === 0) return { linePath: "", areaPath: "", markers: [], lastDay: 0 };

  const firstDay = sorted[0].day;
  const lastDay = sorted[sorted.length - 1].day;
  const daySpan = lastDay - firstDay || 1;
  const balances = sorted.map((p) => p.balanceCents);
  const max = Math.max(...balances);
  const min = Math.min(...balances);
  const domainSpan = max - (min - CHART.bottomRoom * (max - min)) || 1;
  const plotHeight = CHART.baselineY - CHART.topPadding;

  const xOf = (day: number) => ((day - firstDay) / daySpan) * CHART.width;
  const yOf = (cents: number) => CHART.topPadding + ((max - cents) / domainSpan) * plotHeight;
  const points = sorted.map((p) => ({ x: xOf(p.day), y: yOf(p.balanceCents) }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)},${round(p.y)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `M${round(first.x)},${CHART.baselineY} ${linePath.replace(/^M/, "L")} L${round(last.x)},${CHART.baselineY} Z`;

  const labelBottomLimit = CHART.baselineY - CHART.labelFontSize - 2;
  const markerLayouts = markers
    .filter((m) => m.day >= firstDay && m.day <= lastDay)
    .slice(0, CHART.maxMarkers)
    .map((m): MarkerLayout => {
      const cx = xOf(m.day);
      const cy = lineYAt(points, cx);
      const width = estimateLabelWidth(m.label);

      let anchor: LabelAnchor = "middle";
      let labelX = cx;
      let left = cx - width / 2;
      if (left < 0) {
        anchor = "start";
        labelX = 0;
        left = 0;
      } else if (cx + width / 2 > CHART.width) {
        anchor = "end";
        labelX = CHART.width;
        left = CHART.width - width;
      }

      // Keep the whole label below the line across its width, then inside the plot area.
      const clearOfLine = lowestLineYBetween(points, left, left + width) + CHART.labelLineGap;
      const labelY = Math.min(Math.max(cy + CHART.markerLabelOffset, clearOfLine), labelBottomLimit);
      return { day: m.day, label: m.label, cx: round(cx), cy: round(cy), labelX: round(labelX), labelY: round(labelY), anchor };
    });

  return { linePath, areaPath, markers: markerLayouts, lastDay };
}

/** Screen-reader description, e.g. "Lowest point $120 on day 20." */
export function describeBalanceChart(projection: readonly ProjectionPoint[], markers: readonly Pick<MarkerLayout, "day" | "label">[]): string {
  if (projection.length === 0) return "No projected balance is available.";
  const lowest = projection.reduce((low, p) => (p.balanceCents < low.balanceCents ? p : low));
  const lastDay = Math.max(...projection.map((p) => p.day));
  const parts = [`Projected balance over the next ${lastDay} days.`, `Lowest point ${formatUSD(lowest.balanceCents)} on day ${lowest.day}.`];
  if (markers.length > 0) parts.push(`Bills marked: ${markers.map((m) => `${m.label} on day ${m.day}`).join(", ")}.`);
  return parts.join(" ");
}

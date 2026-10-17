import type { ProjectionPoint } from "./types";
import { addDays, dayOfWeek, formatDate } from "../../lib/dates";

/** A bill day with a net loss, or a loss of at least $100, is rainy. */
export function dailyWeather(netCents: number, hasBill: boolean) {
  if (netCents >= 0) return "sunny";
  return hasBill || netCents <= -10000 ? "rainy" : "cloudy";
}

export function forecastDate(asOfDate: string, day: number) {
  const date = addDays(asOfDate, day);
  return {
    date,
    weekday: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dayOfWeek(date)],
    label: formatDate(date, "short"),
  };
}

/** Pair each future day with its previous balance before dividing into weeks. */
export function forecastDays(projection: readonly ProjectionPoint[], openingCents: number, todayNetCents = 0) {
  const sorted = [...projection].sort((a, b) => a.day - b.day);
  return sorted.map((point, index) => ({
    ...point,
    netCents: point.day === 0 ? todayNetCents : point.balanceCents - (sorted[index - 1]?.balanceCents ?? openingCents),
  })).filter((point) => point.day >= 0);
}

/** Horizontal Bezier handles keep the curve inside each pair of daily balances. */
export function weeklyCurve(days: readonly ProjectionPoint[]) {
  if (!days.length) return { points: [], line: "", area: "" };
  const values = days.map((day) => day.balanceCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = days.map((day, index) => ({
    x: (index + 0.5) * 100,
    y: span === 0 ? 100 : 40 + ((max - day.balanceCents) / span) * 100,
  }));
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const point = points[index];
    const middle = (previous.x + point.x) / 2;
    line += ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }
  return { points, line, area: `${line} L ${points.at(-1)!.x} 200 L ${points[0].x} 200 Z` };
}

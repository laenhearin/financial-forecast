import { describe, expect, it } from "vitest";
import { homeData } from "../../test-fixtures/homeData";
import { CHART, describeBalanceChart, estimateLabelWidth, layoutBalanceChart } from "./balanceChartGeometry";
import type { ProjectionPoint } from "./types";

const line = (...pairs: [number, number][]): ProjectionPoint[] => pairs.map(([day, balanceCents]) => ({ day, balanceCents }));

/** Parses "M0,24 L21.33,30 ..." into numbers. */
function pathPoints(path: string) {
  return [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
}

describe("layoutBalanceChart scale", () => {
  it("puts the highest balance at the top padding and leaves 65% of the range below the lowest", () => {
    const { linePath } = layoutBalanceChart(line([0, 100000], [10, 0], [20, 100000]), []);
    const [top, low, end] = pathPoints(linePath);
    expect(top).toEqual({ x: 0, y: CHART.topPadding });
    expect(end).toEqual({ x: CHART.width, y: CHART.topPadding });
    // Lowest point: 1 / 1.65 of the way down the plot area.
    const expected = CHART.topPadding + (CHART.baselineY - CHART.topPadding) / 1.65;
    expect(low.x).toBe(CHART.width / 2);
    expect(low.y).toBeCloseTo(expected, 1);
  });

  it("closes the area along the baseline", () => {
    const { areaPath } = layoutBalanceChart(line([0, 500], [30, 900]), []);
    expect(areaPath.startsWith(`M0,${CHART.baselineY} L0,`)).toBe(true);
    expect(areaPath.endsWith(`L${CHART.width},${CHART.baselineY} Z`)).toBe(true);
  });

  it("handles a flat line and empty data without NaN", () => {
    const flat = layoutBalanceChart(line([0, 5000], [30, 5000]), []);
    expect(flat.linePath).not.toContain("NaN");
    expect(layoutBalanceChart([], [{ day: 3, label: "Rent" }])).toEqual({ linePath: "", areaPath: "", markers: [], lastDay: 0 });
  });
});

describe("layoutBalanceChart markers", () => {
  it("shows at most two markers, on the line, with labels below it", () => {
    const data = line([0, 100000], [10, 20000], [20, 100000], [30, 50000]);
    const { markers, linePath } = layoutBalanceChart(data, [
      { day: 10, label: "Rent" },
      { day: 20, label: "Phone" },
      { day: 30, label: "Car" },
    ]);
    expect(markers.map((m) => m.label)).toEqual(["Rent", "Phone"]);
    const points = pathPoints(linePath);
    expect(markers[0].cy).toBe(points[1].y);
    expect(markers[0].labelY).toBe(markers[0].cy + CHART.markerLabelOffset);
  });

  it("anchors labels at the edges so they stay inside the SVG", () => {
    const data = line([0, 1000], [30, 2000]);
    const { markers } = layoutBalanceChart(data, [
      { day: 0, label: "Insurance renewal" },
      { day: 30, label: "Insurance renewal" },
    ]);
    expect(markers[0]).toMatchObject({ anchor: "start", labelX: 0 });
    expect(markers[1]).toMatchObject({ anchor: "end", labelX: CHART.width });
  });

  it("pushes a label below the line when the line keeps falling past the marker", () => {
    // Steep drop right after the marker: a label 20px under the marker would cross the line.
    const data = line([0, 100000], [14, 90000], [16, 0], [30, 0]);
    const { markers, linePath } = layoutBalanceChart(data, [{ day: 14, label: "Very long bill label" }]);
    const [m] = markers;
    const width = estimateLabelWidth(m.label);
    const left = m.cx - width / 2;
    const lowestInSpan = Math.max(...pathPoints(linePath).filter((p) => p.x >= left && p.x <= left + width).map((p) => p.y));
    expect(m.labelY).toBeGreaterThan(m.cy + CHART.markerLabelOffset);
    expect(m.labelY).toBeGreaterThanOrEqual(Math.min(lowestInSpan + CHART.labelLineGap, CHART.baselineY - CHART.labelFontSize - 2));
  });

  it("ignores markers outside the projected days", () => {
    expect(layoutBalanceChart(line([0, 1], [30, 2]), [{ day: 31, label: "Late" }]).markers).toEqual([]);
  });
});

describe("Home mock chart", () => {
  const layout = layoutBalanceChart(homeData.projection, homeData.markers);

  it("draws both sample bills with labels clear of the line", () => {
    expect(layout.markers.map((m) => m.label)).toEqual(["Rent", "Car + insurance"]);
    for (const m of layout.markers) {
      expect(m.anchor).toBe("middle");
      expect(m.labelY).toBe(m.cy + CHART.markerLabelOffset);
      expect(m.labelY + CHART.labelFontSize).toBeLessThan(CHART.baselineY);
    }
  });

  it("describes the lowest point and the bills", () => {
    expect(describeBalanceChart(homeData.projection, layout.markers)).toBe(
      "Projected balance over the next 30 days. Lowest point $120 on day 20. Bills marked: Rent on day 7, Car + insurance on day 20.",
    );
  });
});

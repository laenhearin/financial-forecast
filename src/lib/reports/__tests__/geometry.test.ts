import { expect, it } from "vitest";
import { axisTicks, barRect, donutSlices, lineGeometry, linearScale } from "../chartGeometry";
it("scales, ticks and bars handle flat/empty inputs", () => {
  expect(linearScale(0, 10, 0, 100)(5)).toBe(50); expect(linearScale(5, 5, 0, 100)(5)).toBe(50);
  expect(axisTicks(0, 0)).toHaveLength(5); expect(barRect(0, 0, 0, 0, 0).height).toBe(0);
  expect(barRect(100, 200, 0, 2, 0).height).toBe(85);
  for (const points of [[], [{ date: "2026-10-17", balanceCents: 0, isForecast: false }]]) {
    const g = lineGeometry(points, 0); expect(g.ticks.every(Number.isFinite)).toBe(true); expect(g.actual).not.toContain("NaN");
  }
});
it("arcs close a circle without NaN, including a single-category donut", () => {
  const slices = donutSlices([10, 20, 30]); expect(slices.reduce((sum, p) => sum + p.end - p.start, 0)).toBeCloseTo(Math.PI * 2);
  for (const amounts of [[], [0], [100], [10, 20, 30]]) expect(JSON.stringify(donutSlices(amounts))).not.toMatch(/NaN|Infinity/);
});

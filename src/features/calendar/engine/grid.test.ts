import { describe, expect, it } from "vitest";
import { loadDemoScenario } from "../../../data/demoDataSource";
import { monthGrid, monthStartOf, shiftMonth, weekDates } from "./grid";
import { buildCalendarModel } from "./model";
import { WEEK_CHART, weekChartPoints, weeklySpending, weekScaleMaxCents } from "./weekly";

describe("month grid", () => {
  it("shows six Monday-first weeks around the month", () => {
    const days = monthGrid("2026-10-01");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-09-28");
    expect(days[3]).toBe("2026-10-01");
    expect(days[41]).toBe("2026-11-08");
  });

  it("moves between months and finds the week", () => {
    expect(monthStartOf("2026-10-17")).toBe("2026-10-01");
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(weekDates("2026-10-17")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  });
});

describe("weekly spending", () => {
  const model = buildCalendarModel(loadDemoScenario("tightMonth"), [], "checking");

  it("sums money going out each day and ignores income", () => {
    expect(weeklySpending(model, "2026-10-21").map((d) => d.spendingCents)).toEqual([0, 14000, 0, 0, 0, 23077, 11000]);
  });

  it("rounds the scale up to a $50 step", () => {
    expect(weekScaleMaxCents(weeklySpending(model, "2026-10-21"))).toBe(25000);
    expect(weekScaleMaxCents(weeklySpending(model, "2026-10-14"))).toBe(5000);
  });

  it("spreads Monday to Sunday across the plot", () => {
    const { points } = weekChartPoints(weeklySpending(model, "2026-10-21"));
    expect(points[0].x).toBe(WEEK_CHART.left);
    expect(points[6].x).toBe(WEEK_CHART.width - WEEK_CHART.right);
    expect(points[0].y).toBe(WEEK_CHART.height - WEEK_CHART.bottom);
  });
});

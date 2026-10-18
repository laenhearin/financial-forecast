import { describe, expect, it } from "vitest";
import { loadTestScenario } from "../../../test-fixtures/scenarios";
import { monthGrid, monthStartOf, shiftMonth, weekDates } from "./grid";
import { buildCalendarModel } from "./model";
import type { CalendarEntry } from "../types";
import { WEEK_CHART, monthlySpending, weekChartPoints, weeklySpending, weekScaleMaxCents } from "./weekly";

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

describe("monthly spending", () => {
  const model = buildCalendarModel(loadTestScenario("tightMonth"), [], "checking");

  it("uses the full calendar month, including leap days and year boundaries", () => {
    const leap = monthlySpending(model, "2028-02-10");
    expect(leap).toHaveLength(29);
    expect(leap[0].date).toBe("2028-02-01");
    expect(leap.at(-1)?.date).toBe("2028-02-29");
    expect(monthlySpending(model, "2027-02-15")).toHaveLength(28);
    expect(monthlySpending(model, "2026-04-15")).toHaveLength(30);
    const december = monthlySpending(model, "2026-12-31");
    expect(december).toHaveLength(31);
    expect(december.at(-1)?.date).toBe("2026-12-31");
  });

  it("includes recorded payments and planned spending once, excluding income and adjacent months", () => {
    const entry = (id: string, date: string, kind: CalendarEntry["kind"], amountCents: number): CalendarEntry => ({
      id, sourceId: id, date, kind, label: id, accountId: "checking", amountCents, recurring: false,
    });
    const scoped = { ...model, entriesByDate: new Map<string, CalendarEntry[]>([
      ["2026-09-30", [entry("before", "2026-09-30", "payment", 9999)]],
      ["2026-10-01", [
        entry("paid", "2026-10-01", "payment", 1250),
        entry("income", "2026-10-01", "income", 100000),
      ]],
      ["2026-10-31", [entry("planned", "2026-10-31", "purchase", 4075)]],
      ["2026-11-01", [entry("after", "2026-11-01", "bill", 50000)]],
    ]) };
    const days = monthlySpending(scoped, "2026-10-17");
    expect(days[0].spendingCents).toBe(1250);
    expect(days[1].spendingCents).toBe(0);
    expect(days.at(-1)?.spendingCents).toBe(4075);
    expect(days.reduce((total, day) => total + day.spendingCents, 0)).toBe(5325);
    expect(weeklySpending(scoped, "2026-10-01").find(day => day.date === "2026-10-01")?.spendingCents).toBe(days[0].spendingCents);
  });

  it("places every monthly day within the same chart bounds", () => {
    const { points } = weekChartPoints(monthlySpending(model, "2026-10-17"));
    expect(points).toHaveLength(31);
    expect(points[0].x).toBe(WEEK_CHART.left);
    expect(points.at(-1)?.x).toBe(WEEK_CHART.width - WEEK_CHART.right);
    expect(points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });
});

describe("weekly spending", () => {
  const model = buildCalendarModel(loadTestScenario("tightMonth"), [], "checking");

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

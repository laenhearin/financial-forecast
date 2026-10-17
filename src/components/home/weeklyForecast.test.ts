import { describe, expect, it } from "vitest";
import { forecastDate, forecastDays, weeklyCurve } from "./weeklyForecast";

describe("weekly forecast", () => {
  it("labels dates consistently across daylight saving and year boundaries", () => {
    expect(forecastDate("2026-10-17", 1)).toEqual({ date: "2026-10-18", weekday: "SUN", label: "Oct 18" });
    expect(forecastDate("2026-10-31", 2)).toEqual({ date: "2026-11-02", weekday: "MON", label: "Nov 2" });
    expect(forecastDate("2026-12-31", 1)).toEqual({ date: "2027-01-01", weekday: "FRI", label: "Jan 1" });
  });
  it("uses the prior day's balance across week boundaries and preserves cents", () => {
    const projection = Array.from({ length: 10 }, (_, day) => ({ day, balanceCents: 10000 - day * 123 }));
    const days = forecastDays(projection, 10000);
    expect(days).toHaveLength(9);
    expect(days[7]).toEqual({ day: 8, balanceCents: 9016, netCents: -123 });
  });
  it("sorts without mutating data and uses the opening balance when needed", () => {
    const projection = [{ day: 2, balanceCents: -100 }, { day: 1, balanceCents: 200 }];
    expect(forecastDays(projection, 500).map((day) => day.netCents)).toEqual([-300, -300]);
    expect(projection[0].day).toBe(2);
  });
  it("handles empty and flat projections without invalid SVG coordinates", () => {
    expect(weeklyCurve([]).line).toBe("");
    expect(weeklyCurve([{ day: 1, balanceCents: 0 }, { day: 2, balanceCents: 0 }]).points).toEqual([{ x: 50, y: 100 }, { x: 150, y: 100 }]);
  });
});

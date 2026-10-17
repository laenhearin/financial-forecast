import { describe, expect, it } from "vitest";
import { dailyWeather, forecastDate, forecastDays, weeklyCurve } from "./weeklyForecast";

describe("weekly forecast", () => {
  it("uses net cash flow for weather, including bill days offset by income", () => {
    expect(dailyWeather(0, true)).toBe("sunny");
    expect(dailyWeather(50000, true)).toBe("sunny");
    expect(dailyWeather(-9999, false)).toBe("cloudy");
    expect(dailyWeather(-10000, false)).toBe("rainy");
    expect(dailyWeather(-1, true)).toBe("rainy");
  });
  it("labels dates consistently across daylight saving and year boundaries", () => {
    expect(forecastDate("2026-10-17", 1)).toEqual({ date: "2026-10-18", weekday: "SUN", label: "Oct 18" });
    expect(forecastDate("2026-10-31", 2)).toEqual({ date: "2026-11-02", weekday: "MON", label: "Nov 2" });
    expect(forecastDate("2026-12-31", 1)).toEqual({ date: "2027-01-01", weekday: "FRI", label: "Jan 1" });
  });
  it("uses the prior day's balance across week boundaries and preserves cents", () => {
    const projection = Array.from({ length: 10 }, (_, day) => ({ day, balanceCents: 10000 - day * 123 }));
    const days = forecastDays(projection, 10000);
    expect(days).toHaveLength(10);
    expect(days[8]).toEqual({ day: 8, balanceCents: 9016, netCents: -123 });
    expect(days.slice(0, 7).map(day => day.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it("uses recorded net activity for today without changing tomorrow's delta", () => {
    expect(forecastDays([{ day: 0, balanceCents: 50000 }, { day: 1, balanceCents: 48000 }], 50000, -15000))
      .toEqual([{ day: 0, balanceCents: 50000, netCents: -15000 }, { day: 1, balanceCents: 48000, netCents: -2000 }]);
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

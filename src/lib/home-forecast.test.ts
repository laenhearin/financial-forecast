import { describe, expect, it } from "vitest";
import { buildHomeForecast } from "./home-forecast";
import { makeScenario, monthlyBill } from "../features/big-purchase/engine/testScenario";
import { forecastDate, forecastDays } from "../components/home/weeklyForecast";

describe("selected profile home forecast", () => {
  it("feeds the weekly graph the profile's date, balances, and bills", () => {
    const home = buildHomeForecast(makeScenario({
      customerName: "Selected profile", asOfDate: "2026-12-31", balanceCents: 50000,
      bills: [monthlyBill("rent", 12000, 1)],
    }));
    expect(home.userName).toBe("Selected profile");
    expect(home.isSampleData).toBe(true);
    expect(home.availableBalanceCents).toBe(50000);
    expect(home.projection).toHaveLength(31);
    const first = forecastDays(home.projection, home.availableBalanceCents)[0];
    expect(first).toEqual({ day: 1, balanceCents: 38000, netCents: -12000 });
    expect(forecastDate(home.asOfDate, first.day).date).toBe("2027-01-01");
    expect(home.markers).toContainEqual({ day: 1, label: "Rent" });
  });
  it("does not retain the previous profile's data", () => {
    buildHomeForecast(makeScenario({ balanceCents: 90000 }));
    const home = buildHomeForecast(makeScenario({ customerName: "Another profile", balanceCents: 20000 }));
    expect(home.userName).toBe("Another profile");
    expect(home.projection.every(point => point.balanceCents === 20000)).toBe(true);
    expect(home.markers).toEqual([]);
  });
});

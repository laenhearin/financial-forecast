import { describe, expect, it } from "vitest";
import { ROUTES } from "../lib/navigation";
import { homeData, interpolateDaily } from "./homeData";

describe("interpolateDaily", () => {
  it("fills every day with whole cents and keeps the keyframes exact", () => {
    const points = interpolateDaily([
      { day: 0, balanceCents: 1000 },
      { day: 3, balanceCents: 0 },
    ]);
    expect(points).toEqual([
      { day: 0, balanceCents: 1000 },
      { day: 1, balanceCents: 667 },
      { day: 2, balanceCents: 333 },
      { day: 3, balanceCents: 0 },
    ]);
  });

  it("returns nothing for no keyframes", () => {
    expect(interpolateDaily([])).toEqual([]);
  });
});

describe("homeData", () => {
  it("has 31 daily points from day 0 to day 30 matching the spec keyframes", () => {
    expect(homeData.projection).toHaveLength(31);
    expect(homeData.projection.map((p) => p.day)).toEqual(Array.from({ length: 31 }, (_, i) => i));
    const at = (day: number) => homeData.projection[day].balanceCents;
    expect([at(0), at(5), at(7), at(10), at(14), at(17), at(20), at(23), at(27), at(30)]).toEqual([
      234000, 215500, 86000, 100000, 197000, 183000, 12000, 30500, 215500, 234000,
    ]);
    expect(homeData.projection.every((p) => Number.isSafeInteger(p.balanceCents))).toBe(true);
  });

  it("links cards to their pages", () => {
    expect(homeData.cards.map((c) => c.href)).toEqual([ROUTES.stormSolver, ROUTES.bigPurchase, ROUTES.cashBack]);
  });
});

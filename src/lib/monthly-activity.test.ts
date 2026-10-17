import { describe, expect, it } from "vitest";
import { monthlyActivity } from "./monthly-activity";

describe("recorded monthly activity", () => {
  it("separates income and spending, excluding future and prior-month records", () => {
    expect(monthlyActivity([
      { date: "2026-10-01", kind: "deposit", amountCents: 100001 },
      { date: "2026-10-17", kind: "withdrawal", amountCents: 12345 },
      { date: "2026-10-18", kind: "deposit", amountCents: 90000 },
      { date: "2026-09-30", kind: "withdrawal", amountCents: 50000 },
    ], "2026-10-17")).toEqual({ incomeCents: 100001, spendingCents: 12345 });
  });
  it("handles empty history and rejects unsafe amounts", () => {
    expect(monthlyActivity([], "2026-10-17")).toEqual({ incomeCents: 0, spendingCents: 0 });
    expect(() => monthlyActivity([{ date: "2026-10-01", kind: "deposit", amountCents: 1.5 }], "2026-10-17")).toThrow();
    expect(() => monthlyActivity([{ date: "2026-10-01", kind: "transfer", amountCents: 100 }], "2026-10-17")).toThrow("Unknown recorded activity");
  });
});

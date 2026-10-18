import { describe, expect, it } from "vitest";
import { historicalBalances, type RecordedActivity } from "./historical-balances";

const row = (date: string, kind: RecordedActivity["kind"], amountCents: number, id = date): RecordedActivity => ({ id, date, kind, amountCents, label: "Transaction" });

describe("historical balances", () => {
  it("reverses today's activity once and aggregates deposits and withdrawals", () => {
    const records = [row("2026-10-17", "withdrawal", 500), row("2026-10-15", "deposit", 2000), row("2026-10-15", "withdrawal", 123, "a"), row("2026-10-15", "withdrawal", 77, "b"), row("2026-10-14", "withdrawal", 50), row("2026-10-18", "deposit", 99999)];
    const days = historicalBalances(records, "2026-10-17", 10000);
    expect(days.map(({ day, balanceCents, netCents, spendingCents }) => ({ day, balanceCents, netCents, spendingCents }))).toEqual([
      { day: -3, balanceCents: 8700, netCents: -50, spendingCents: 50 },
      { day: -2, balanceCents: 10500, netCents: 1800, spendingCents: 200 },
      { day: -1, balanceCents: 10500, netCents: 0, spendingCents: 0 },
    ]);
    expect(days[1].transactions).toHaveLength(3);
    expect(records[0].date).toBe("2026-10-17");
  });
  it("preserves spending when income offsets it, and negative balances across years", () => {
    const [day] = historicalBalances([row("2026-12-31", "deposit", 1000), row("2026-12-31", "withdrawal", 1000, "b")], "2027-01-01", -500);
    expect(day).toMatchObject({ day: -1, balanceCents: -500, netCents: 0, spendingCents: 1000 });
  });
  it("limits history to available records and preserves whole days across DST", () => {
    expect(historicalBalances([], "2026-10-17", 0)).toEqual([]);
    expect(historicalBalances([row("2026-10-17", "deposit", 100)], "2026-10-17", 0)).toEqual([]);
    const days = historicalBalances([row("2026-10-31", "withdrawal", 100)], "2026-11-09", 500);
    expect(days.map(day => day.day)).toEqual([-9,-8,-7,-6,-5,-4,-3,-2,-1]);
  });
  it("rejects invalid dates, fractional amounts and unsafe arithmetic", () => {
    expect(() => historicalBalances([], "invalid", 0)).toThrow();
    for (const cents of [-1, 0.5, NaN]) expect(() => historicalBalances([row("2026-10-16", "deposit", cents)], "2026-10-17", 0)).toThrow();
    expect(() => historicalBalances([row("2026-10-17", "withdrawal", 1)], "2026-10-17", Number.MAX_SAFE_INTEGER)).toThrow();
  });
});

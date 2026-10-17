import { describe, expect, it } from "vitest";
import { forecastBalance } from "./forecast";
import type { ScheduledEvent } from "./types";
const events: ScheduledEvent[] = [
  { id: "rent", name: "Rent", date: "2026-10-18", amountCents: 65000, type: "expense" },
  { id: "pay", name: "Paycheck", date: "2026-10-20", amountCents: 50000, type: "income" },
];
describe("forecastBalance", () => {
  it("shows a shortfall before payday and recovery afterward", () => {
    expect(forecastBalance(60000, "2026-10-17", 4, events).map(day => day.closingBalanceCents)).toEqual([60000, -5000, -5000, 45000]);
  });
  it("does not count historical transactions again", () => {
    expect(forecastBalance(10000, "2026-10-19", 1, events)[0].closingBalanceCents).toBe(10000);
  });
  it("handles leap days and month boundaries", () => {
    expect(forecastBalance(0, "2028-02-28", 3, []).map(day => day.date)).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });
  it("rejects fractional cents and invalid dates", () => {
    expect(() => forecastBalance(1.5, "2026-10-17", 1, [])).toThrow();
    expect(() => forecastBalance(0, "2026-02-30", 1, [])).toThrow();
  });
  it("keeps scenarios separate from original events", () => {
    const original = JSON.stringify(events);
    const purchase: ScheduledEvent = { id: "what-if", name: "Purchase", date: "2026-10-18", amountCents: 15000, type: "expense" };
    const base = forecastBalance(90000, "2026-10-17", 4, events);
    const scenario = forecastBalance(90000, "2026-10-17", 4, [...events, purchase]);
    expect(scenario[1].closingBalanceCents).toBe(base[1].closingBalanceCents - 15000);
    expect(JSON.stringify(events)).toBe(original);
  });
});

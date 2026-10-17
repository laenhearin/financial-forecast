import { describe, expect, it } from "vitest";
import { loadTestScenario } from "../../../test-fixtures/scenarios";
import { dayOfWeek } from "../../../lib/dates";
import { weeklySpendingCents } from "../../big-purchase/engine/events";
import { billPriority, forecastEndDate, primaryAccountId, scenarioEntries } from "./entries";

const scenario = loadTestScenario("tightMonth");
const entries = scenarioEntries(scenario);

describe("billPriority", () => {
  it("maps scenario bills to essential, important or optional", () => {
    const priority = Object.fromEntries(scenario.bills.map((bill) => [bill.id, billPriority(bill)]));
    expect(priority).toMatchObject({
      rent: "essential",
      phone: "essential",
      internet: "essential",
      utilities: "essential",
      "car-payment": "important",
      "car-insurance": "important",
      gym: "optional",
      streaming: "optional",
    });
  });
});

describe("scenarioEntries", () => {
  it("covers the days after the as-of date through the 90-day window, on the paycheck account", () => {
    expect(primaryAccountId(scenario)).toBe("checking");
    expect(forecastEndDate("2026-10-17")).toBe("2027-01-15");
    expect(entries.every((e) => e.date > scenario.asOfDate && e.date <= "2027-01-15")).toBe(true);
    expect(entries.every((e) => e.accountId === "checking")).toBe(true);
    expect(entries.every((e) => Number.isSafeInteger(e.amountCents) && e.amountCents > 0)).toBe(true);
  });

  it("lists bills on their due dates with a priority", () => {
    expect(entries[0]).toMatchObject({ date: "2026-10-20", kind: "bill", label: "Car insurance", amountCents: 14000, priority: "important" });
    expect(entries.find((e) => e.date === "2026-11-01" && e.kind === "bill")).toMatchObject({ label: "Rent", amountCents: 120000, priority: "essential" });
    expect(entries.find((e) => e.kind === "income")).toMatchObject({ date: "2026-10-23", label: "Paycheck", amountCents: 225000 });
  });

  it("folds weekly spending into one Saturday estimate", () => {
    const estimates = entries.filter((e) => e.kind === "estimate");
    const weekly = scenario.spending.reduce((sum, c) => sum + weeklySpendingCents(c.monthlyAmountCents), 0);
    expect(estimates.length).toBeGreaterThan(10);
    expect(estimates.every((e) => dayOfWeek(e.date) === 6 && e.amountCents === weekly)).toBe(true);
    expect(estimates[0]).toMatchObject({ date: "2026-10-24", amountCents: 23077, detail: "Groceries, Dining out, Shopping, Entertainment, Gas" });
  });

  it("marks one-off expenses as planned", () => {
    expect(entries.filter((e) => e.kind === "planned").map((e) => [e.date, e.label])).toEqual([
      ["2026-12-12", "Car registration"],
      ["2026-12-20", "Holiday gifts"],
    ]);
  });
});

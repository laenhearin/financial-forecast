import { describe, expect, it } from "vitest";
import { loadDemoScenario } from "../../../data/demoDataSource";
import { projectBase } from "../../big-purchase/engine/base";
import type { UserPurchase } from "../types";
import { balanceOn, buildCalendarModel, dayAlert, lowestBalance, riskLevel, upcomingBills } from "./model";

const scenario = loadDemoScenario("tightMonth");
const purchase = (date: string, amountCents: number, accountId = "checking"): UserPurchase => ({
  id: `p-${date}-${amountCents}`,
  label: "Test",
  amountCents,
  date,
  accountId,
});

describe("buildCalendarModel balances", () => {
  it("matches Big purchase's base projection for the checking account", () => {
    const model = buildCalendarModel(scenario, [], "checking");
    const base = projectBase(scenario).days.slice(0, 91);
    expect([...model.balances].map(([date, b]) => [date, b.totalCents])).toEqual(base.map((d) => [d.date, d.baseCents]));
    expect(balanceOn(model, "2026-10-20")).toBe(36000);
    expect(balanceOn(model, "2026-10-24")).toBe(237923);
  });

  it("adds savings in the combined view and keeps per-account balances", () => {
    const all = buildCalendarModel(scenario, [], "all");
    expect(all.startingCents).toBe(170000);
    expect(all.balances.get("2026-10-20")).toEqual({ totalCents: 156000, byAccount: { checking: 36000, savings: 120000 } });
  });

  it("counts purchases from today on, lists earlier ones, and skips other accounts", () => {
    const model = buildCalendarModel(scenario, [purchase("2026-10-17", 2500), purchase("2026-10-10", 9900), purchase("2026-10-18", 1000, "savings")], "checking");
    expect(balanceOn(model, "2026-10-17")).toBe(47500);
    expect(model.entriesByDate.get("2026-10-10")?.map((e) => e.kind)).toEqual(["purchase"]);
    expect(model.entriesByDate.has("2026-10-18")).toBe(false);
    expect(balanceOn(model, "2026-10-16")).toBeNull();
    expect(balanceOn(model, "2027-01-16")).toBeNull();
  });
});

describe("riskLevel", () => {
  it("shades by share of the starting balance", () => {
    const base = 100000;
    expect([80000, 75000, 50000, 25000, 10000, 0, -1].map((b) => riskLevel(b, base))).toEqual([0, 1, 2, 3, 4, 4, 5]);
    expect(riskLevel(null, base)).toBe(0);
  });
});

describe("summary numbers", () => {
  const model = buildCalendarModel(scenario, [], "checking");

  it("finds the lowest projected balance in the window", () => {
    const base = projectBase(scenario).days.slice(0, 91);
    const min = Math.min(...base.map((d) => d.baseCents));
    expect(lowestBalance(model)).toEqual({ date: base.find((d) => d.baseCents === min)?.date, cents: min });
  });

  it("totals upcoming bills", () => {
    const bills = model.entries.filter((e) => e.kind === "bill");
    expect(upcomingBills(model)).toEqual({ count: bills.length, totalCents: bills.reduce((s, b) => s + b.amountCents, 0) });
  });
});

describe("dayAlert", () => {
  const model = buildCalendarModel(scenario, [purchase("2026-10-18", 60000)], "checking");

  it("explains days without a forecast", () => {
    expect(dayAlert(model, "2026-10-01").text).toMatch(/in the past/);
    expect(dayAlert(model, "2027-02-01").text).toMatch(/90-day forecast window/);
  });

  it("warns below zero and reassures when comfortable", () => {
    expect(dayAlert(model, "2026-10-20")).toEqual({ tone: "danger", text: "⚠️ Danger: your projected balance is $240 below zero." });
    expect(dayAlert(model, "2026-10-23").tone).toBe("safe");
  });
});

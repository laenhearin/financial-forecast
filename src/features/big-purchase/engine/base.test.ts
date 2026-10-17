import { describe, expect, it } from "vitest";
import { projectBase, startingCash } from "./base";
import { buildEvents, weeklySpendingCents } from "./events";
import { category, makeScenario, monthlyBill, paycheck } from "./testScenario";

// As-of Thursday 2026-01-01. Paydays every other Friday from Jan 2. Saturdays: Jan 3, 10, 17...
const scenario = makeScenario({
  balanceCents: 50_000,
  accounts: [
    { id: "checking", nickname: "Checking", type: "checking", balanceCents: 50_000, includeInForecast: true },
    { id: "savings", nickname: "Savings", type: "savings", balanceCents: 99_900, includeInForecast: false },
  ],
  income: [paycheck(100_000, "2026-01-02")],
  bills: [monthlyBill("rent", 80_000, 1), monthlyBill("phone", 5_000, 5)],
  spending: [category("food", 52_000)],
  oneOffs: [{ id: "gift", label: "Gift", date: "2026-01-07", amountCents: 2_500, type: "expense" }],
});

describe("projectBase", () => {
  it("starts from included accounts only", () => {
    expect(startingCash(scenario)).toBe(50_000);
  });

  it("produces hand-calculated end-of-day balances", () => {
    const { days } = projectBase(scenario);
    const on = (date: string) => days.find(day => day.date === date)?.baseCents;
    // Rent on Jan 1 is already in the as-of balance.
    expect(on("2026-01-01")).toBe(50_000);
    expect(on("2026-01-02")).toBe(150_000);          // + paycheck
    expect(on("2026-01-03")).toBe(150_000 - 12_000); // weekly food = 52,000 * 12 / 52
    expect(on("2026-01-05")).toBe(138_000 - 5_000);  // phone
    expect(on("2026-01-07")).toBe(133_000 - 2_500);  // gift
    expect(on("2026-01-10")).toBe(130_500 - 12_000);
    expect(on("2026-02-01")).toBe(118_500 + 100_000 * 2 - 12_000 * 3 - 80_000); // payday Jan 16, 30; Saturdays Jan 17, 24, 31; rent Feb 1
  });

  it("covers the 24-month horizon and lists paydays after the as-of date", () => {
    const projection = projectBase(scenario);
    expect(projection.days[0].date).toBe("2026-01-01");
    expect(projection.days.at(-1)?.date).toBe("2028-01-01");
    expect(projection.days).toHaveLength(731);
    expect(projection.paydays.slice(0, 3)).toEqual(["2026-01-02", "2026-01-16", "2026-01-30"]);
  });

  it("counts two paychecks on one date as one contribution date", () => {
    const twoJobs = makeScenario({ income: [paycheck(10_000, "2026-01-02", "a"), paycheck(20_000, "2026-01-02", "b")] });
    const projection = projectBase(twoJobs);
    expect(projection.paydays.slice(0, 2)).toEqual(["2026-01-02", "2026-01-16"]);
    expect(projection.days[1].baseCents).toBe(130_000);
  });

  it("applies mods without mutating the scenario", () => {
    const before = JSON.stringify(scenario);
    const removed = projectBase(scenario, { removedBillIds: ["phone"] });
    const moved = projectBase(scenario, { billDueDays: { phone: 9 } });
    const cut = projectBase(scenario, { categoryCutPercents: { food: 50 } });
    expect(removed.days[4].baseCents).toBe(138_000); // Jan 5, no phone
    expect(moved.days[4].baseCents).toBe(138_000);
    expect(moved.days[8].baseCents).toBe(projectBase(scenario).days[8].baseCents); // Jan 9, same cash after the move
    expect(cut.days[2].baseCents).toBe(150_000 - 6_000);
    expect(JSON.stringify(scenario)).toBe(before);
  });
});

describe("spending events", () => {
  it("weekly events sum to within one cent per week of the monthly amount", () => {
    for (const monthly of [39_000, 26_000, 1_549, 12_345, 0]) {
      const events = buildEvents(makeScenario({ asOfDate: "2026-01-02", spending: [category("x", monthly)] }))
        .filter(event => event.kind === "spending")
        .slice(0, 52);
      const yearly = -events.reduce((sum, event) => sum + event.deltaCents, 0);
      expect(Math.abs(yearly - monthly * 12)).toBeLessThanOrEqual(52);
      expect(events.every(event => new Date(`${event.date}T00:00:00Z`).getUTCDay() === 6)).toBe(true);
    }
  });

  it("reduces weekly amounts by the cut percent", () => {
    expect(weeklySpendingCents(26_000)).toBe(6_000);
    expect(weeklySpendingCents(26_000, 40)).toBe(3_600);
  });
});

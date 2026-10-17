import { describe, expect, it } from "vitest";
import { loadDemoScenario } from "../../../data/demoDataSource";
import type { CreditCard } from "../types";
import { cardSummary, compareCards } from "./cardAdvice";
import { buildCalendarModel, lowestBalance } from "./model";
import { nextBills, stormAdvice } from "./stormAdvice";

const scenario = loadDemoScenario("tightMonth");
const model = buildCalendarModel(scenario, [], "checking");
const names = { checking: "Everyday Checking", savings: "Savings" };

describe("stormAdvice", () => {
  it("lists each bill once at its next due date, essential first", () => {
    expect(nextBills(model).map((b) => [b.sourceId, b.date])).toEqual([
      ["utilities", "2026-10-25"],
      ["rent", "2026-11-01"],
      ["phone", "2026-11-12"],
      ["internet", "2026-11-15"],
      ["car-insurance", "2026-10-20"],
      ["car-payment", "2026-11-05"],
      ["gym", "2026-11-03"],
      ["streaming", "2026-11-08"],
    ]);
  });

  it("explains timing, the buffer and the order of operations", () => {
    const items = stormAdvice(model, names, 10000);
    expect(items[0]).toMatchObject({ title: "Utilities", tag: "Essential", tone: "high", meta: "$110 · Everyday Checking · next due Oct 25" });
    expect(items[0].text).toMatch(/scheduled in 8 days \(Oct 25\)\.$/);
    expect(items.find((i) => i.id === "income-timing")).toMatchObject({ title: "Plan around incoming money", meta: "Scheduled in 6 days." });
    expect(items.at(-1)?.meta).toMatch(/^4 essential bills and 2 optional bills/);
  });

  it("flags the buffer only when an account drops below it", () => {
    const low = lowestBalance(model).cents;
    expect(stormAdvice(model, names, low + 1).find((i) => i.id === "buffer")?.title).toBe("Protect your cash buffer");
    expect(stormAdvice(model, names, Math.min(low, 0)).find((i) => i.id === "buffer")?.title).toBe("Your cash buffer");
  });
});

const card = (id: string, aprPercent: number, balanceCents: number, limitCents: number, rewards = ""): CreditCard => ({ id, name: id, aprPercent, balanceCents, limitCents, rewards });

describe("compareCards", () => {
  it("asks for missing details", () => {
    expect(compareCards([], 5000)[0].title).toBe("Add your card details first");
    expect(compareCards([card("A", 20, 0, 100000)], null)[0].title).toBe("Enter a purchase amount");
    expect(compareCards([card("A", 20, 95000, 100000)], 10000)[0].title).toBe("No card has enough listed available credit");
  });

  it("ranks by APR and post-purchase utilization", () => {
    const items = compareCards([card("Low use", 20, 0, 100000), card("Carried", 15, 50000, 100000)], 10000);
    expect(items.map((i) => i.title)).toEqual(["First card to consider: Low use", "Carried", "Before you use a card"]);
    expect(items[0].text).toMatch(/^At least one listed card has a balance/);
    expect(items[0].meta).toBe("APR 20.00% · Estimated post-purchase balance $100 · Estimated utilization 10.0%");
    expect(items[1].text).toMatch(/Its APR is not higher/);
  });

  it("summarizes a card", () => {
    expect(cardSummary(card("Everyday", 24.99, 35000, 200000, "2% cash back"))).toBe(
      "APR 24.99% · Balance $350 / $2,000 · $1,650 available · 18% utilization · 2% cash back",
    );
  });
});

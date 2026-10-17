import { describe, expect, it } from "vitest";
import { analyzeCashBack, windowStartDate } from "../engine/analyze";
import { categorize } from "../engine/categorize";
import { loadDemoCashBackData, validateCashBackData, type CashBackData } from "./source";

// Locks the demo story. If an edit to demoPurchases.ts or the card library breaks one, retune the data.
const data = loadDemoCashBackData();
const purchases = categorize(data.purchases);
const run = (windowDays: 30 | 90, selectedCardIds = data.ownedCardIds) =>
  analyzeCashBack({ purchases, selectedCardIds, asOfDate: data.asOfDate, windowDays });

describe("demo lock: cash back", () => {
  it("loads valid demo data for Alex Rivera", () => {
    expect(data.customerName).toBe("Alex Rivera");
    expect(validateCashBackData(data)).toEqual([]);
    expect(windowStartDate(data.asOfDate, 30)).toBe("2026-09-18");
    expect(windowStartDate(data.asOfDate, 90)).toBe("2026-07-20");
  });

  it("flags several gas and grocery purchases on the wrong card in the last 30 days", () => {
    const { flags } = run(30);
    expect(flags.filter(flag => flag.category === "gas").length).toBeGreaterThanOrEqual(3);
    expect(flags.filter(flag => flag.category === "groceries").length).toBeGreaterThanOrEqual(3);
    expect(flags.every(flag => flag.category === "gas" || flag.category === "groceries")).toBe(true);
  });

  it("shows a clear amount left on the table", () => {
    const thirty = run(30);
    expect(thirty.rewards.missedCents).toBeGreaterThanOrEqual(800);
    expect(thirty.missedAnnualCents).toBeGreaterThanOrEqual(10_000);
    const ninety = run(90);
    expect(ninety.rewards.missedCents).toBeGreaterThan(thirty.rewards.missedCents);
    expect(ninety.purchaseCount).toBe(data.purchases.length);
  });

  it("reconciles flags with the total in both windows", () => {
    for (const windowDays of [30, 90] as const) {
      const { flags, rewards } = run(windowDays);
      const flagged = flags.reduce((sum, flag) => sum + flag.missedCents, 0);
      expect(flagged + rewards.capAdjustmentCents).toBe(rewards.missedCents);
    }
  });

  it("puts gas on Road Rewards and groceries on Market Fresh, with Market Fresh's cap room shown", () => {
    const { playbook } = run(30);
    expect(playbook.find(entry => entry.category === "gas")?.primary.cardId).toBe("road-rewards");
    const groceries = playbook.find(entry => entry.category === "groceries");
    expect(groceries?.primary.cardId).toBe("market-fresh");
    expect(groceries?.cap).toMatchObject({ amountCents: 30_000, period: "monthly", remainingCents: 20_060 });
  });

  it("suggests a modest-fee card and skips Premium Gold", () => {
    const { suggestion } = run(30);
    expect(suggestion.suggestion).not.toBeNull();
    expect(suggestion.suggestion!.isHighFee).toBe(false);
    expect(suggestion.suggestion!.netAnnualCents).toBeGreaterThan(0);
    expect(suggestion.suggestion!.cardId).not.toBe("premium-gold");
    expect(suggestion.skippedHighFee.map(item => item.cardId)).toContain("premium-gold");
  });

  it("drops the gas flags when Road Rewards is removed", () => {
    const { flags } = run(30, ["everyday-1", "market-fresh"]);
    expect(flags.some(flag => flag.category === "gas")).toBe(false);
  });

  it("stops suggesting a card once the user adds it", () => {
    const first = run(30).suggestion.suggestion!;
    const after = run(30, [...data.ownedCardIds, first.cardId]);
    expect(after.suggestion.suggestion?.cardId).not.toBe(first.cardId);
    expect(after.rewards.bestCents).toBeGreaterThan(run(30).rewards.bestCents);
  });

  it("is deterministic", () => {
    expect(run(90)).toEqual(run(90));
  });
});

describe("validateCashBackData", () => {
  const base: CashBackData = { customerName: "Test", asOfDate: "2026-10-17", ownedCardIds: ["everyday-1"], purchases: [] };

  it("reports each problem", () => {
    const problems = validateCashBackData({
      ...base,
      ownedCardIds: ["everyday-1", "nope"],
      purchases: [
        { id: "a", date: "2026-10-18", merchant: "Shell", amountCents: 100, cardId: "everyday-1" },
        { id: "a", date: "2026-02-30", merchant: " ", amountCents: 0, cardId: "road-rewards" },
        { id: "b", date: "2026-10-01", merchant: "Shell", amountCents: 1.5, cardId: "mystery" },
      ],
    });
    expect(problems).toEqual([
      `Owned card "nope" is not in the card library.`,
      "Purchase a (Shell) is dated after the as-of date.",
      "Purchase a ( ) has a duplicate id.",
      `Purchase a ( ) has an invalid date "2026-02-30".`,
      "Purchase a ( ) needs a positive amount.",
      "Purchase a ( ) has no merchant name.",
      `Purchase a ( ) uses card "road-rewards", which the customer does not own.`,
      "Purchase b (Shell) needs a positive amount.",
      `Purchase b (Shell) uses card "mystery", which is not in the card library.`,
    ]);
  });
});

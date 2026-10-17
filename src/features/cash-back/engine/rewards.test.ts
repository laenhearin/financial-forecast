import { describe, expect, it } from "vitest";
import { findCard } from "../cards/library";
import { annualizeCents, bestCardForPurchase, CapLedger, computeRewards, flagWrongCardPurchases, periodKey, scoreCard } from "./rewards";
import { buy, card } from "./testHelpers";

describe("cap periods", () => {
  it("uses calendar months and quarters", () => {
    expect(periodKey("2026-10-17", "monthly")).toBe("2026-10");
    expect(periodKey("2026-10-17", "quarterly")).toBe("2026-Q4");
    expect(periodKey("2026-03-31", "quarterly")).toBe("2026-Q1");
    expect(periodKey("2026-04-01", "quarterly")).toBe("2026-Q2");
  });
});

describe("scoreCard", () => {
  it("pays the base rate outside bonus categories", () => {
    const option = scoreCard(card("road-rewards"), "dining", 10_000, "2026-10-01", new CapLedger());
    expect(option).toMatchObject({ rewardCents: 100, rateBps: 100, capped: false, capRemainingCents: null });
  });

  it("pays the bonus rate on an uncapped tier", () => {
    expect(scoreCard(card("dine-play"), "dining", 4_550, "2026-10-01", new CapLedger()).rewardCents).toBe(137); // 3% of $45.50 = 136.5
  });

  it("splits a purchase that crosses the cap", () => {
    const ledger = new CapLedger();
    ledger.record(card("market-fresh"), "groceries", 25_000, "2026-10-02");
    const option = scoreCard(card("market-fresh"), "groceries", 10_000, "2026-10-09", ledger);
    // $50 at 3% plus $50 at 1%
    expect(option).toMatchObject({ rewardCents: 200, rateBps: 300, capped: true, capRemainingCents: 5_000, capPeriod: "monthly" });
  });

  it("resets the cap in the next period", () => {
    const ledger = new CapLedger();
    ledger.record(card("market-fresh"), "groceries", 30_000, "2026-10-02");
    expect(scoreCard(card("market-fresh"), "groceries", 10_000, "2026-10-30", ledger).rewardCents).toBe(100);
    expect(scoreCard(card("market-fresh"), "groceries", 10_000, "2026-11-01", ledger).rewardCents).toBe(300);
  });

  it("tracks quarterly caps across months", () => {
    const ledger = new CapLedger();
    ledger.record(card("click-ship"), "online", 100_000, "2026-10-05");
    ledger.record(card("click-ship"), "online", 40_000, "2026-11-05");
    const option = scoreCard(card("click-ship"), "online", 20_000, "2026-12-05", ledger);
    expect(option).toMatchObject({ capRemainingCents: 10_000, rewardCents: 600 }); // $100 at 5% + $100 at 1%
  });
});

describe("bestCardForPurchase", () => {
  const cards = [card("everyday-1"), card("road-rewards"), card("steady-2")];

  it("ranks by reward on the purchase", () => {
    const ranked = bestCardForPurchase({ category: "gas", amountCents: 5_000, date: "2026-10-01" }, cards, new CapLedger());
    expect(ranked.map(option => [option.cardId, option.rewardCents])).toEqual([["road-rewards", 200], ["steady-2", 100], ["everyday-1", 50]]);
  });

  it("hands off to the next-best card once the cap is reached", () => {
    const ledger = new CapLedger();
    ledger.record(card("road-rewards"), "gas", 40_000, "2026-10-01");
    const ranked = bestCardForPurchase({ category: "gas", amountCents: 5_000, date: "2026-10-20" }, cards, ledger);
    expect(ranked[0].cardId).toBe("steady-2");
    expect(ranked.find(option => option.cardId === "road-rewards")).toMatchObject({ capped: true, capRemainingCents: 0, rewardCents: 50 });
  });

  it("prefers the uncapped card, then the lower fee, then input order on ties", () => {
    const ranked = bestCardForPurchase({ category: "other", amountCents: 1_000, date: "2026-10-01" }, [card("grocery-max"), card("everyday-1")], new CapLedger());
    expect(ranked[0].cardId).toBe("everyday-1");
  });

  it("returns an empty list without cards", () => {
    expect(bestCardForPurchase({ category: "gas", amountCents: 100, date: "2026-10-01" }, [], new CapLedger())).toEqual([]);
  });
});

describe("computeRewards and flags", () => {
  const owned = [card("everyday-1"), card("road-rewards"), card("market-fresh")];

  it("scores each purchase with the card used and the best card", () => {
    const result = computeRewards([
      buy("2026-10-01", "gas", 10_000, "everyday-1", "Shell"),
      buy("2026-10-02", "groceries", 5_000, "market-fresh", "Publix"),
    ], owned);
    expect(result).toMatchObject({ actualCents: 250, bestCents: 550, missedCents: 300, capAdjustmentCents: 0 });
    const flags = flagWrongCardPurchases(result);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ merchant: "Shell", usedCardId: "everyday-1", betterCardId: "road-rewards", usedRateBps: 100, betterRateBps: 400, missedCents: 300 });
  });

  it("keeps the card used when it ties with the best card", () => {
    const result = computeRewards([buy("2026-10-01", "dining", 2_000, "road-rewards")], owned);
    expect(result.scored[0].best.cardId).toBe("road-rewards");
    expect(flagWrongCardPurchases(result)).toEqual([]);
  });

  it("still scores purchases on a card the user deselected", () => {
    const result = computeRewards([buy("2026-10-01", "gas", 10_000, "road-rewards")], [card("everyday-1")], { findCard });
    expect(result).toMatchObject({ actualCents: 400, bestCents: 400, missedCents: 0 });
  });

  it("warms up caps with earlier purchases but only totals the window", () => {
    const purchases = [
      buy("2026-10-01", "groceries", 30_000, "market-fresh"),
      buy("2026-10-10", "groceries", 10_000, "everyday-1"),
    ];
    const result = computeRewards(purchases, owned, { from: "2026-10-05" });
    expect(result.scored).toHaveLength(1);
    // Market Fresh's $300 cap is used up, so the 1% card was already the best choice.
    expect(result).toMatchObject({ actualCents: 100, bestCents: 100, missedCents: 0 });
  });

  it("reports cap hand-offs as a separate adjustment so the totals reconcile", () => {
    const result = computeRewards([
      buy("2026-10-01", "groceries", 30_000, "everyday-1"),
      buy("2026-10-02", "groceries", 10_000, "market-fresh"),
    ], owned);
    // Following the playbook, the first purchase takes the whole $300 cap (900 vs 300), and the
    // second, which really earned 3%, would only have earned 1% (100 vs 300).
    expect(result).toMatchObject({ actualCents: 600, bestCents: 1_000, missedCents: 400, capAdjustmentCents: -200 });
    const flaggedTotal = flagWrongCardPurchases(result).reduce((sum, flag) => sum + flag.missedCents, 0);
    expect(flaggedTotal + result.capAdjustmentCents).toBe(result.missedCents);
  });

  it("rejects purchases on unknown cards", () => {
    expect(() => computeRewards([buy("2026-10-01", "gas", 100, "mystery-card")], owned)).toThrow(/unknown card/);
  });

  it("is deterministic regardless of input order", () => {
    const purchases = [
      buy("2026-10-03", "groceries", 12_000, "everyday-1"),
      buy("2026-10-01", "groceries", 25_000, "market-fresh"),
      buy("2026-10-02", "gas", 4_000, "market-fresh"),
    ];
    expect(computeRewards([...purchases].reverse(), owned)).toEqual(computeRewards(purchases, owned));
  });
});

describe("annualizeCents", () => {
  it("scales to 365 days and rounds to the cent", () => {
    expect(annualizeCents(1_043, 30)).toBe(12_690);
    expect(annualizeCents(1_000, 90)).toBe(4_056);
    expect(() => annualizeCents(100, 0)).toThrow();
  });
});

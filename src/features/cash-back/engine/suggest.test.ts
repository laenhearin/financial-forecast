import { describe, expect, it } from "vitest";
import { CARD_LIBRARY, findCard } from "../cards/library";
import { suggestNewCard } from "./suggest";
import { buy, card } from "./testHelpers";

const options = { from: "2026-09-18", windowDays: 30, findCard };

describe("suggestNewCard", () => {
  it("suggests the low-fee card with the largest yearly gain and reports its fee", () => {
    const purchases = [buy("2026-10-01", "dining", 300_000, "everyday-1")];
    const { suggestion, skippedHighFee } = suggestNewCard(purchases, [card("everyday-1")], CARD_LIBRARY, options);
    // Dine & Play adds 2% of $3,000 = $60 in 30 days, $730 a year, no fee.
    expect(suggestion).toMatchObject({ cardId: "dine-play", annualFeeCents: 0, isHighFee: false, gainWindowCents: 6_000, gainAnnualCents: 73_000, netAnnualCents: 73_000 });
    expect(suggestion?.topCategories).toEqual([{ category: "dining", gainWindowCents: 6_000 }]);
    // Premium Gold adds $1,095 a year but nets only $770 after its $325 fee: not a clear win.
    expect(skippedHighFee).toEqual([{ cardId: "premium-gold", cardName: "Premium Gold Rewards", annualFeeCents: 32_500, gainAnnualCents: 109_500, netAnnualCents: 77_000 }]);
  });

  it("suggests a high-fee card only when it clearly beats the alternatives", () => {
    const purchases = [
      buy("2026-10-01", "dining", 300_000, "everyday-1"),
      buy("2026-10-02", "groceries", 300_000, "everyday-1"),
    ];
    const { suggestion, skippedHighFee } = suggestNewCard(purchases, [card("everyday-1")], CARD_LIBRARY, options);
    expect(suggestion).toMatchObject({ cardId: "premium-gold", isHighFee: true, annualFeeCents: 32_500, gainWindowCents: 18_000, netAnnualCents: 186_500 });
    expect(skippedHighFee).toEqual([]);
  });

  it("subtracts the fee when ranking low-fee cards", () => {
    // $500 of groceries: Grocery Max adds 5% ($25, $304 a year) but costs $95; Steady 2% adds $5 ($61 a year) free.
    const purchases = [buy("2026-10-01", "groceries", 50_000, "everyday-1")];
    const { suggestion } = suggestNewCard(purchases, [card("everyday-1")], CARD_LIBRARY, options);
    expect(suggestion).toMatchObject({ cardId: "grocery-max", gainAnnualCents: 30_417, netAnnualCents: 20_917 });
  });

  it("suggests nothing when no card adds more than it costs", () => {
    const allButPremium = CARD_LIBRARY.filter(item => item.id !== "premium-gold");
    const purchases = [buy("2026-10-01", "other", 10_000, "steady-2")];
    expect(suggestNewCard(purchases, allButPremium, CARD_LIBRARY, options)).toEqual({ suggestion: null, skippedHighFee: [] });
  });

  it("never suggests a card the user already has", () => {
    const purchases = [buy("2026-10-01", "dining", 300_000, "everyday-1")];
    const { suggestion } = suggestNewCard(purchases, [card("everyday-1"), card("dine-play")], CARD_LIBRARY, options);
    expect(suggestion?.cardId).not.toBe("dine-play");
  });
});

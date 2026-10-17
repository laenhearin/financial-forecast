import { describe, expect, it } from "vitest";
import { buildPlaybook, lookupPurchase } from "./playbook";
import { CapLedger } from "./rewards";
import { buy, card } from "./testHelpers";

const asOf = "2026-10-17";

describe("buildPlaybook", () => {
  it("picks the best card per category and orders by spending", () => {
    const playbook = buildPlaybook(
      [card("everyday-1"), card("road-rewards"), card("market-fresh")],
      [buy("2026-10-01", "groceries", 20_000, "everyday-1"), buy("2026-10-02", "gas", 5_000, "everyday-1")],
      asOf,
      new CapLedger(),
    );
    expect(playbook.slice(0, 2).map(entry => [entry.category, entry.primary.cardId, entry.primary.rateBps])).toEqual([
      ["groceries", "market-fresh", 300],
      ["gas", "road-rewards", 400],
    ]);
    expect(playbook).toHaveLength(9);
    expect(playbook.find(entry => entry.category === "dining")).toMatchObject({ spendCents: 0, cap: null, fallback: null });
  });

  it("shows cap room left this period and who takes over after the cap", () => {
    const ledger = new CapLedger();
    ledger.record(card("road-rewards"), "gas", 15_000, "2026-10-04");
    ledger.record(card("road-rewards"), "gas", 9_000, "2026-09-28"); // last month: doesn't count
    const withSteady = buildPlaybook([card("road-rewards"), card("steady-2")], [], asOf, ledger);
    expect(withSteady.find(entry => entry.category === "gas")).toMatchObject({
      primary: { cardId: "road-rewards", rateBps: 400 },
      cap: { amountCents: 40_000, period: "monthly", remainingCents: 25_000, afterCapRateBps: 200 },
      fallback: { cardId: "steady-2", rateBps: 200 },
    });
    const alone = buildPlaybook([card("road-rewards"), card("everyday-1")], [], asOf, ledger);
    expect(alone.find(entry => entry.category === "gas")).toMatchObject({ cap: { afterCapRateBps: 100 }, fallback: null });
  });

  it("is empty without cards", () => {
    expect(buildPlaybook([], [], asOf, new CapLedger())).toEqual([]);
  });
});

describe("lookupPurchase", () => {
  const cards = [card("everyday-1"), card("market-fresh")];

  it("returns the best card, its reward, and cap room after the purchase", () => {
    const ledger = new CapLedger();
    ledger.record(card("market-fresh"), "groceries", 9_940, "2026-10-09");
    const result = lookupPurchase({ category: "groceries", amountCents: 8_000 }, cards, ledger, asOf);
    expect(result).toMatchObject({
      best: { cardId: "market-fresh", rewardCents: 240, capRemainingCents: 20_060 },
      runnerUp: { cardId: "everyday-1", rewardCents: 80 },
      capRemainingAfterCents: 12_060,
    });
  });

  it("reports no cap room for uncapped rates", () => {
    expect(lookupPurchase({ category: "dining", amountCents: 1_000 }, cards, new CapLedger(), asOf)?.capRemainingAfterCents).toBeNull();
  });

  it("returns null for a zero amount or no cards", () => {
    expect(lookupPurchase({ category: "gas", amountCents: 0 }, cards, new CapLedger(), asOf)).toBeNull();
    expect(lookupPurchase({ category: "gas", amountCents: 100 }, [], new CapLedger(), asOf)).toBeNull();
  });
});

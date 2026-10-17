import { describe, expect, it } from "vitest";
import { CARD_CATALOG } from "../features/cash-back/cards/catalog";
import { validateCashBackData } from "../features/cash-back/data/source";
import { analyzeWallet } from "../features/cash-back/engine/analyze";
import { homeMessage } from "../features/cash-back/engine/homeMessage";
import { buildTable } from "../features/cash-back/engine/table";
import { DEMO_OWNED_CARD_IDS, loadTestCashBackProfile } from "./cashBackProfile";

// Locks the reward engine's results on a fixed fixture. If an edit to cashBackProfile.ts or the catalog breaks one, retune the data.
const profile = loadTestCashBackProfile();
const run = (ownedCardIds: readonly string[] = profile.ownedCardIds, dismissedSuggestions: string[] = []) =>
  analyzeWallet({ ownedCardIds, spendProfile: profile.spendProfile, today: profile.asOfDate, dismissedSuggestions });
const analysis = run();

describe("fixture lock: cash back", () => {
  it("starts the fixture customer with Savor, Quicksilver, Discover it, and Blue Cash Everyday on Oct 17, 2026", () => {
    expect(profile).toMatchObject({ customerName: "Fixture Customer", asOfDate: "2026-10-17", sourceLabel: "Test fixture" });
    expect(analysis.owned.map(card => card.id).sort()).toEqual([...DEMO_OWNED_CARD_IDS].sort());
    expect(analysis.owned.every(card => card.annualFeeCents === 0)).toBe(true);
  });

  it("earns about $598 a year with the fixture cards", () => {
    expect(analysis.projection.totalCents).toBe(59_820);
  });

  it("gives each card the categories in the story", () => {
    const winnerOf = (category: string) => analysis.winners.find(item => item.category === category)?.winner?.cardId;
    expect(["dining", "entertainment", "utilities"].map(winnerOf)).toEqual(Array(3).fill("discover-it-cash-back"));
    expect(["groceries", "streaming"].map(winnerOf)).toEqual(Array(2).fill("capital-one-savor"));
    expect(["other", "transit", "drugstores"].map(winnerOf)).toEqual(Array(3).fill("capital-one-quicksilver"));
    expect(["gas", "online_shopping", "amazon"].map(winnerOf)).toEqual(Array(3).fill("amex-blue-cash-everyday"));
    expect(analysis.gold.map(gold => gold.cardId)).toEqual([
      "discover-it-cash-back", "capital-one-savor", "capital-one-quicksilver", "amex-blue-cash-everyday",
    ]);
  });

  it("suggests Citi Custom Cash, then Blue Cash Preferred and U.S. Bank Cash+", () => {
    expect(analysis.suggestions.map(item => [item.cardId, item.netGainCents, item.takesOver])).toEqual([
      ["citi-custom-cash", 10_800, ["groceries"]],
      ["amex-blue-cash-preferred", 9_040, ["groceries", "streaming", "transit"]],
      ["us-bank-cash-plus", 8_780, ["utilities", "streaming"]],
    ]);
    expect(run(undefined, ["citi-custom-cash"]).suggestions[0].cardId).toBe("amex-blue-cash-preferred");
  });

  it("shows the Discover rotating bonus on the homepage card", () => {
    expect(homeMessage(analysis)).toEqual({
      kind: "rotating",
      cardId: "discover-it-cash-back",
      category: "dining",
      title: "Use Discover it for dining",
      body: "5% back through Dec 31. Bonus room left this quarter shown below.",
      figure: "$1,165 left at 5%",
    });
  });

  it("falls back to the suggestion, then the yearly total, on the homepage card", () => {
    const withoutDiscover = run(DEMO_OWNED_CARD_IDS.filter(id => id !== "discover-it-cash-back"));
    expect(homeMessage(withoutDiscover)).toEqual({
      kind: "suggestion", cardId: "citi-custom-cash", title: "Add Citi Custom Cash?", body: "Takes over Groceries.", figure: "+$108/yr",
    });
    const everything = run(DEMO_OWNED_CARD_IDS, CARD_CATALOG.map(card => card.id));
    expect(homeMessage({ ...everything, winners: everything.winners.map(item => ({ ...item, winner: item.winner && { ...item.winner, source: "category" } })) }))
      .toEqual({ kind: "working", title: "Your cards are working", body: "Best card set for 11 categories.", figure: "$598/yr" });
  });

  it("pins the gold cards above the Capital One group", () => {
    const groups = buildTable(CARD_CATALOG, new Set(DEMO_OWNED_CARD_IDS), analysis.gold, { search: "", sort: "issuer", ownership: "all", showBusiness: false });
    expect(groups.map(group => group.label)).toEqual([
      "Your best cards", "Capital One", "Chase", "American Express", "Citi", "Wells Fargo", "Bank of America", "U.S. Bank", "Apple",
    ]);
    // Spark Cash Plus is a business card, hidden until asked for.
    expect(groups[1].cards.map(card => card.id)).not.toContain("capital-one-spark-cash-plus");
    expect(groups[0].cards.map(card => card.id)).toEqual(analysis.gold.map(gold => gold.cardId));
    // Discover's only card is owned and pinned, so its group is empty and hidden.
    expect(groups.find(group => group.id === "Discover")).toBeUndefined();
  });

  it("still accepts the seeded Nessie purchase contract with old sample-card ids", () => {
    const seeded = { customerName: "Seed", asOfDate: "2026-10-17", ownedCardIds: ["steady-2", "dine-play"], purchases: [
      { id: "p1", date: "2026-10-01", merchant: "Kroger", amountCents: 14_500, cardId: "steady-2" },
    ] };
    expect(validateCashBackData(seeded)).toEqual([]);
    expect(validateCashBackData({ ...seeded, ownedCardIds: ["nope"], purchases: [] })).toEqual(['Owned card "nope" is not in the card catalog.']);
  });
});

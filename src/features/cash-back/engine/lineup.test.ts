import { describe, expect, it } from "vitest";
import { DEMO_AS_OF_DATE, DEMO_OWNED_CARD_IDS, DEMO_SPEND_PROFILE } from "../data/demoProfile";
import type { SpendProfile } from "../types";
import { analyzeWallet } from "./analyze";
import { buildLineup } from "./lineup";

const lineupFor = (ownedCardIds: readonly string[], spendProfile: SpendProfile = DEMO_SPEND_PROFILE, today = DEMO_AS_OF_DATE) =>
  buildLineup(analyzeWallet({ ownedCardIds, spendProfile, today }), today);

describe("buildLineup", () => {
  it("groups the demo wallet by card, biggest spend first", () => {
    const { rows, unusedCardIds } = lineupFor(DEMO_OWNED_CARD_IDS);
    expect(rows.map(row => [row.cardId, row.categories.map(item => `${item.category} ${item.rateBps}`)])).toEqual([
      ["discover-it-cash-back", ["dining 500", "utilities 500", "entertainment 500"]],
      ["capital-one-savor", ["groceries 300", "streaming 300"]],
      ["capital-one-quicksilver", ["other 150", "transit 150", "drugstores 150"]],
      ["amex-blue-cash-everyday", ["gas 300", "online_shopping 300", "amazon 300"]],
    ]);
    expect(rows[0].categories.every(item => item.rotating)).toBe(true);
    expect(unusedCardIds).toEqual([]);
  });

  it("notes a cap that runs out this period, and what takes over", () => {
    const { rows } = lineupFor(DEMO_OWNED_CARD_IDS);
    expect(rows[0].capNotes).toEqual([{
      remainingCents: 116_451,
      rateBps: 500,
      period: "quarter",
      then: [
        { cardId: "capital-one-savor", rateBps: 300, categories: ["dining", "entertainment"] },
        { cardId: "capital-one-quicksilver", rateBps: 150, categories: ["utilities"] },
      ],
    }]);
    // Blue Cash Everyday's $6,000 yearly caps are nowhere near used up.
    expect(rows.slice(1).every(row => row.capNotes.length === 0)).toBe(true);
  });

  it("skips the note when the cap lasts the period", () => {
    const { rows } = lineupFor(DEMO_OWNED_CARD_IDS, { dining: 10_000, groceries: 20_000 });
    expect(rows.find(row => row.cardId === "discover-it-cash-back")?.capNotes).toEqual([]);
  });

  it("lists owned cards that win nothing", () => {
    const { rows, unusedCardIds } = lineupFor([...DEMO_OWNED_CARD_IDS, "bofa-customized-cash"]);
    expect(rows.map(row => row.cardId)).not.toContain("bofa-customized-cash");
    expect(unusedCardIds).toEqual(["bofa-customized-cash"]);
    expect(lineupFor([])).toEqual({ rows: [], unusedCardIds: [] });
  });
});

import { describe, expect, it } from "vitest";
import { compareCardList, compareCards, MAX_COMPARE_CARDS } from "./compare";

const TODAY = "2026-10-17";
const SAVOR = "capital-one-savor";
const QUICKSILVER = "capital-one-quicksilver";
const VENTURE_X = "capital-one-venture-x";
/** $500 a month on dining and $500 on everything else: $12,000 a year. */
const SPEND = { dining: 50_000, other: 50_000 };

describe("compareCards", () => {
  const result = compareCards({ cardIds: [SAVOR, QUICKSILVER, VENTURE_X], ownedCardIds: [QUICKSILVER], spendProfile: SPEND, today: TODAY });

  it("projects each card alone on a year of spending, net of its annual fee", () => {
    expect(result.yearlySpendCents).toBe(1_200_000);
    expect(result.cards.map(card => [card.cardId, card.yearlyRewardsCents, card.annualFeeCents, card.netCents, card.returnBps])).toEqual([
      // 3% dining ($180) + 1% other ($60)
      [SAVOR, 24_000, 0, 24_000, 200],
      // 1.5% on everything
      [QUICKSILVER, 18_000, 0, 18_000, 150],
      // 2x miles at 1 cent ($240) less the $395 fee
      [VENTURE_X, 24_000, 39_500, -15_500, 200],
    ]);
  });

  it("picks the card with the most left after fees and says by how much", () => {
    expect(result.bestCardId).toBe(SAVOR);
    expect(result.runnerUpCardId).toBe(QUICKSILVER);
    expect(result.marginCents).toBe(6_000);
  });

  it("shows what each card adds to the cards the user already has", () => {
    const added = Object.fromEntries(result.cards.map(card => [card.cardId, card.addedNetCents]));
    // Savor takes dining from Quicksilver: $180 at 3% instead of $90 at 1.5%.
    expect(added).toEqual({ [SAVOR]: 9_000, [QUICKSILVER]: null, [VENTURE_X]: 6_000 - 39_500 });
    expect(result.cards.find(card => card.cardId === QUICKSILVER)?.owned).toBe(true);
  });

  it("breaks rewards down by category and marks the leader in each", () => {
    expect(result.rows).toEqual([
      { category: "dining", monthlySpendCents: 50_000, rewardCents: [18_000, 9_000, 12_000], bestCardIds: [SAVOR] },
      { category: "other", monthlySpendCents: 50_000, rewardCents: [6_000, 9_000, 12_000], bestCardIds: [VENTURE_X] },
    ]);
    expect(result.cards[0].topCategories).toEqual(["dining", "other"]);
  });

  it("breaks a tie on the lower fee, then the more popular card", () => {
    const tie = compareCards({ cardIds: ["capital-one-quicksilver-student", QUICKSILVER], ownedCardIds: [], spendProfile: SPEND, today: TODAY });
    expect(tie.cards[0].netCents).toBe(tie.cards[1].netCents);
    expect(tie.bestCardId).toBe(QUICKSILVER);
    expect(tie.marginCents).toBe(0);
  });

  it("names no winner for a single card and no return rate without spending", () => {
    const single = compareCards({ cardIds: [SAVOR], ownedCardIds: [], spendProfile: SPEND, today: TODAY });
    expect([single.bestCardId, single.marginCents, single.rows[0].bestCardIds]).toEqual([null, null, []]);
    const empty = compareCards({ cardIds: [SAVOR, VENTURE_X], ownedCardIds: [], spendProfile: {}, today: TODAY });
    expect(empty.cards.map(card => card.returnBps)).toEqual([null, null]);
    expect(empty.rows).toEqual([]);
    expect(empty.bestCardId).toBe(SAVOR);
  });
});

describe("compareCardList", () => {
  it("keeps known, distinct cards in the order picked, up to the limit", () => {
    const ids = compareCardList(["nope", VENTURE_X, VENTURE_X, SAVOR, QUICKSILVER, "citi-double-cash"]).map(card => card.id);
    expect(ids).toEqual([VENTURE_X, SAVOR, QUICKSILVER]);
    expect(ids).toHaveLength(MAX_COMPARE_CARDS);
  });
});

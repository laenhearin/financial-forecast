import { describe, expect, it } from "vitest";
import { CARD_CATALOG, cardsByIds, findCard } from "../cards/catalog";
import { DEMO_AS_OF_DATE, DEMO_OWNED_CARD_IDS, DEMO_SPEND_PROFILE } from "../../../test-fixtures/cashBackProfile";
import type { CreditCard, SpendProfile } from "../types";
import {
  bestCardsByCategory, CapLedger, chosenCategories, estimateCapUsage, getEffectiveRate, goldCards, periodKey,
  projectWalletRewards, rankCards, suggestCards, SUGGESTION_MIN_NET_CENTS,
} from "./rewards";

function card(id: string): CreditCard {
  const found = findCard(id);
  if (!found) throw new Error(`Unknown card ${id}`);
  return found;
}

const savor = card("capital-one-savor");
const discover = card("discover-it-cash-back");
const blueCashEveryday = card("amex-blue-cash-everyday");
const demoWallet = cardsByIds(DEMO_OWNED_CARD_IDS);
const NOV = "2026-11-15";

describe("periodKey", () => {
  it("names calendar months, quarters, and years", () => {
    expect(periodKey("2026-10-17", "month")).toBe("2026-10");
    expect(periodKey("2026-10-17", "quarter")).toBe("2026-Q4");
    expect(periodKey("2027-01-01", "quarter")).toBe("2027-Q1");
    expect(periodKey("2026-12-31", "year")).toBe("2026");
  });
});

describe("getEffectiveRate", () => {
  it("uses category rules", () => {
    expect(getEffectiveRate(savor, "groceries", { today: NOV })).toMatchObject({ rateBps: 300, source: "category", capRemainingCents: null });
    expect(getEffectiveRate(card("amex-gold"), "dining", { today: NOV })).toMatchObject({ rateBps: 400, source: "category", capRemainingCents: 5_000_000 });
  });

  it("falls back to the base rate", () => {
    expect(getEffectiveRate(savor, "gas", { today: NOV })).toMatchObject({ rateBps: 100, source: "base" });
    expect(getEffectiveRate(card("capital-one-ventureone"), "other", { today: NOV }).rateBps).toBe(125);
  });

  it("uses rotating categories only inside their dates", () => {
    const flex = card("chase-freedom-flex");
    expect(getEffectiveRate(flex, "dining", { today: NOV })).toMatchObject({ rateBps: 700, source: "rotating" });
    expect(getEffectiveRate(flex, "dining", { today: "2027-01-15" })).toMatchObject({ rateBps: 300, source: "category" });
    expect(getEffectiveRate(flex, "groceries", { today: "2026-09-30" })).toMatchObject({ rateBps: 100, source: "base" });
  });

  it("drops a rotating rate once its cap is used up", () => {
    const fresh = getEffectiveRate(discover, "utilities", { today: NOV });
    expect(fresh).toMatchObject({ rateBps: 500, source: "rotating", capRemainingCents: 150_000 });
    const ledger = new CapLedger();
    ledger.add(fresh.pool!, NOV, 149_999);
    expect(getEffectiveRate(discover, "utilities", { today: NOV, ledger })).toMatchObject({ rateBps: 500, capRemainingCents: 1 });
    ledger.add(fresh.pool!, NOV, 1);
    expect(getEffectiveRate(discover, "utilities", { today: NOV, ledger })).toMatchObject({ rateBps: 100, source: "base", capRemainingCents: null });
    // The rotating cap is shared, so dining is used up too, and it resets next quarter.
    expect(getEffectiveRate(discover, "dining", { today: NOV, ledger }).rateBps).toBe(100);
    expect(getEffectiveRate(discover, "dining", { today: "2026-12-31", ledger }).rateBps).toBe(100);
  });

  it("counts Amazon as online shopping on cards without an Amazon rule", () => {
    expect(getEffectiveRate(blueCashEveryday, "amazon", { today: NOV })).toMatchObject({ rateBps: 300, source: "category" });
    expect(getEffectiveRate(card("chase-prime-visa"), "amazon", { today: NOV }).rateBps).toBe(500);
    expect(getEffectiveRate(savor, "amazon", { today: NOV }).rateBps).toBe(100);
  });

  it("gives Custom Cash's 5% to the option with the highest spend", () => {
    const customCash = card("citi-custom-cash");
    const profile: SpendProfile = { groceries: 45_000, dining: 35_000, gas: 16_000 };
    expect(chosenCategories(customCash, { spendProfile: profile })).toEqual(["groceries"]);
    expect(getEffectiveRate(customCash, "groceries", { today: NOV, spendProfile: profile })).toMatchObject({ rateBps: 500, source: "selectable", capRemainingCents: 50_000 });
    expect(getEffectiveRate(customCash, "dining", { today: NOV, spendProfile: profile }).rateBps).toBe(100);
    expect(chosenCategories(customCash, { spendProfile: { gas: 1 } })).toEqual(["gas"]);
  });

  it("uses stored picks for user-choice cards, and defaults when the picks are invalid", () => {
    const customized = card("bofa-customized-cash");
    expect(chosenCategories(customized, {})).toEqual(["dining"]);
    expect(chosenCategories(customized, { selections: { [customized.id]: ["gas"] } })).toEqual(["gas"]);
    expect(chosenCategories(customized, { selections: { [customized.id]: ["groceries"] } })).toEqual(["dining"]);
    const cashPlus = card("us-bank-cash-plus");
    expect(chosenCategories(cashPlus, { selections: { [cashPlus.id]: ["dining", "dining"] } })).toEqual(["utilities", "streaming"]);
    expect(getEffectiveRate(cashPlus, "transit", { today: NOV, selections: { [cashPlus.id]: ["transit", "dining"] } }).rateBps).toBe(500);
  });

  it("drops BofA Customized Cash to 1% after the shared $2,500 quarterly cap", () => {
    const customized = card("bofa-customized-cash");
    const dining = getEffectiveRate(customized, "dining", { today: NOV });
    const groceries = getEffectiveRate(customized, "groceries", { today: NOV });
    expect(dining).toMatchObject({ rateBps: 300, source: "selectable" });
    expect(groceries).toMatchObject({ rateBps: 200, source: "category" });
    expect(groceries.pool!.key).toBe(dining.pool!.key);

    const ledger = new CapLedger();
    ledger.add(groceries.pool!, NOV, 250_000);
    expect(getEffectiveRate(customized, "dining", { today: NOV, ledger })).toMatchObject({ rateBps: 100, source: "base" });
    expect(getEffectiveRate(customized, "wholesale", { today: NOV, ledger }).rateBps).toBe(100);
    expect(getEffectiveRate(customized, "dining", { today: "2027-01-02", ledger }).rateBps).toBe(300);
  });
});

describe("rankCards", () => {
  it("breaks the demo grocery tie in favor of Savor: no cap beats a cap", () => {
    expect(rankCards(demoWallet, "groceries", { today: NOV }).map(option => option.cardId).slice(0, 2))
      .toEqual(["capital-one-savor", "amex-blue-cash-everyday"]);
  });

  it("then prefers a lower fee, then popularity, with no issuer preference", () => {
    const flat = cardsByIds(["citi-double-cash", "wells-fargo-active-cash", "capital-one-spark-cash-plus"]);
    // All three earn 2% on "other"; Spark has a fee, and Double Cash (6) is more popular than Active Cash (9).
    expect(rankCards(flat, "other", { today: NOV }).map(option => option.cardId))
      .toEqual(["citi-double-cash", "wells-fargo-active-cash", "capital-one-spark-cash-plus"]);
    // Same rate and fee: the more popular card wins whoever issues it, in either input order.
    const pair = ["bofa-unlimited-cash", "capital-one-quicksilver-secured"];
    const byPopularity = cardsByIds(pair).sort((a, b) => a.popularityRank - b.popularityRank).map(card => card.id);
    expect(rankCards(cardsByIds(pair), "other", { today: NOV }).map(option => option.cardId)).toEqual(byPopularity);
    expect(rankCards(cardsByIds([...pair].reverse()), "other", { today: NOV }).map(option => option.cardId)).toEqual(byPopularity);
  });
});

describe("projectWalletRewards", () => {
  const projection = projectWalletRewards(demoWallet, DEMO_SPEND_PROFILE, DEMO_AS_OF_DATE);
  const category = (id: string) => projection.categories.find(item => item.category === id)!;
  const spendOn = (id: string, cardId: string) => category(id).byCard.find(share => share.cardId === cardId)?.spendCents ?? 0;

  it("splits dining: Discover until its Q4 cap, then Savor", () => {
    // Oct and Nov use $650 a month of the shared $1,500 cap; dining goes first in December and gets $200.
    expect(spendOn("dining", "discover-it-cash-back")).toBe(90_000);
    expect(spendOn("dining", "capital-one-savor")).toBe(330_000);
    expect(spendOn("utilities", "discover-it-cash-back")).toBe(44_000);
    expect(spendOn("entertainment", "discover-it-cash-back")).toBe(16_000);
    expect(category("dining").spendCents).toBe(12 * 35_000);
  });

  it("adds up per card and per category", () => {
    const fromCards = Object.values(projection.byCard).reduce((sum, cents) => sum + cents, 0);
    const fromCategories = projection.categories.reduce((sum, item) => sum + item.rewardCents, 0);
    expect(fromCards).toBe(projection.totalCents);
    expect(fromCategories).toBe(projection.totalCents);
    expect(Object.keys(projection.byCard).sort()).toEqual([...DEMO_OWNED_CARD_IDS].sort());
  });

  it("uses normal rates after the rotating quarter ends", () => {
    const later = projectWalletRewards([discover], { utilities: 10_000 }, "2027-01-15");
    expect(later.totalCents).toBe(12 * 100);
  });

  it("resets monthly caps each month", () => {
    const customCash = card("citi-custom-cash");
    // $600 a month: $500 at 5%, $100 at 1%, every month.
    expect(projectWalletRewards([customCash], { groceries: 60_000 }, "2027-03-05").totalCents).toBe(12 * (2_500 + 100));
  });

  it("earns nothing with no cards", () => {
    expect(projectWalletRewards([], DEMO_SPEND_PROFILE, DEMO_AS_OF_DATE).totalCents).toBe(0);
  });
});

describe("estimateCapUsage", () => {
  it("prorates this month by the days before today", () => {
    const ledger = estimateCapUsage(demoWallet, DEMO_SPEND_PROFILE, DEMO_AS_OF_DATE);
    const pool = getEffectiveRate(discover, "dining", { today: DEMO_AS_OF_DATE }).pool!;
    // 16 of 31 October days of $350 dining, $220 utilities, and $80 entertainment.
    expect(ledger.used(pool, DEMO_AS_OF_DATE)).toBe(18_065 + 11_355 + 4_129);
    expect(estimateCapUsage(demoWallet, DEMO_SPEND_PROFILE, "2026-10-01").used(pool, "2026-10-01")).toBe(0);
  });
});

describe("bestCardsByCategory", () => {
  const winners = bestCardsByCategory(demoWallet, DEMO_SPEND_PROFILE, DEMO_AS_OF_DATE);
  const winnerOf = (id: string) => winners.find(item => item.category === id)!;

  it("covers all 14 categories with a winner and runner-up", () => {
    expect(winners).toHaveLength(14);
    expect(winnerOf("groceries").winner?.cardId).toBe("capital-one-savor");
    expect(winnerOf("groceries").runnerUp?.cardId).toBe("amex-blue-cash-everyday");
    expect(winnerOf("utilities").winner).toMatchObject({ cardId: "discover-it-cash-back", rateBps: 500, source: "rotating" });
    expect(winnerOf("amazon").winner?.cardId).toBe("amex-blue-cash-everyday");
    expect(winnerOf("other").winner?.cardId).toBe("capital-one-quicksilver");
  });

  it("marks a card gold only if it wins a category with spend", () => {
    expect(goldCards(winners).map(gold => gold.cardId).sort()).toEqual([...DEMO_OWNED_CARD_IDS].sort());
    // Prime Visa wins only Amazon; with no Amazon spend it is not gold.
    const wallet = cardsByIds(["capital-one-quicksilver", "chase-prime-visa"]);
    const noAmazon = goldCards(bestCardsByCategory(wallet, { other: 10_000 }, NOV));
    expect(noAmazon.map(gold => gold.cardId)).toEqual(["capital-one-quicksilver"]);
    const withAmazon = goldCards(bestCardsByCategory(wallet, { other: 10_000, amazon: 20_000 }, NOV));
    expect(withAmazon).toEqual([
      { cardId: "chase-prime-visa", categories: ["amazon"], monthlySpendCents: 20_000 },
      { cardId: "capital-one-quicksilver", categories: ["other"], monthlySpendCents: 10_000 },
    ]);
  });

  it("returns no winners with no cards", () => {
    expect(bestCardsByCategory([], DEMO_SPEND_PROFILE, NOV).every(item => item.winner === null)).toBe(true);
    expect(goldCards(bestCardsByCategory([], DEMO_SPEND_PROFILE, NOV))).toEqual([]);
  });
});

describe("suggestCards", () => {
  const all = suggestCards(demoWallet, CARD_CATALOG, DEMO_SPEND_PROFILE, DEMO_AS_OF_DATE, 30);

  it("never returns owned or business cards, and keeps only net gains of $25 or more", () => {
    expect(all.length).toBeGreaterThan(0);
    for (const suggestion of all) {
      expect(DEMO_OWNED_CARD_IDS).not.toContain(suggestion.cardId);
      expect(findCard(suggestion.cardId)!.isBusiness).toBe(false);
      expect(suggestion.netGainCents).toBeGreaterThanOrEqual(SUGGESTION_MIN_NET_CENTS);
    }
    const nets = all.map(item => item.netGainCents);
    expect(nets).toEqual([...nets].sort((a, b) => b - a));
  });

  it("subtracts the annual fee", () => {
    for (const suggestion of all) expect(suggestion.netGainCents).toBe(suggestion.gainCents - suggestion.annualFeeCents);
    const preferred = all.find(item => item.cardId === "amex-blue-cash-preferred")!;
    expect(preferred.annualFeeCents).toBe(9_500);
  });

  it("drops cards under the threshold, respects the limit, and skips excluded cards", () => {
    const top = suggestCards(demoWallet, CARD_CATALOG, DEMO_SPEND_PROFILE, DEMO_AS_OF_DATE);
    expect(top).toHaveLength(3);
    expect(top).toEqual(all.slice(0, 3));
    const rest = suggestCards(demoWallet, CARD_CATALOG, DEMO_SPEND_PROFILE, DEMO_AS_OF_DATE, 3, { exclude: [top[0].cardId] });
    expect(rest[0]).toEqual(top[1]);
    // At $10 a month, no card adds $25 a year.
    expect(suggestCards(demoWallet, CARD_CATALOG, { other: 1_000 }, DEMO_AS_OF_DATE)).toEqual([]);
  });

  it("lists the categories a card takes over and any membership it needs", () => {
    const prime = suggestCards(cardsByIds(["capital-one-quicksilver"]), CARD_CATALOG, { amazon: 100_000 }, NOV, 30)
      .find(item => item.cardId === "chase-prime-visa")!;
    expect(prime).toMatchObject({ takesOver: ["amazon"], requiresMembership: "Amazon Prime" });
  });
});

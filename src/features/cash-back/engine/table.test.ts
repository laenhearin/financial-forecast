import { describe, expect, it } from "vitest";
import { CARD_CATALOG, findCard } from "../cards/catalog";
import type { CreditCard } from "../types";
import type { GoldCard } from "./rewards";
import { buildTable, matchesSearch, topRateChips, type TableQuery } from "./table";

const card = (id: string): CreditCard => findCard(id)!;
const query = (change: Partial<TableQuery> = {}): TableQuery => ({ search: "", sort: "issuer", ownership: "all", showBusiness: false, ...change });
const ids = (groups: ReturnType<typeof buildTable>) => groups.flatMap(group => group.cards.map(item => item.id));

describe("matchesSearch", () => {
  it("matches name, full name, and issuer, ignoring case", () => {
    expect(matchesSearch(card("capital-one-savor"), "SAVOR")).toBe(true);
    expect(matchesSearch(card("amex-gold"), "american express gold")).toBe(true);
    expect(matchesSearch(card("discover-it-cash-back"), "capital one company")).toBe(true);
    expect(matchesSearch(card("capital-one-savor"), "  ")).toBe(true);
  });

  it("matches category labels for categories the card rewards", () => {
    const gas = CARD_CATALOG.filter(item => matchesSearch(item, "gas")).map(item => item.id);
    expect(gas).toContain("amex-blue-cash-everyday");
    expect(gas).toContain("citi-custom-cash");
    expect(gas).not.toContain("capital-one-quicksilver");
    expect(matchesSearch(card("discover-it-cash-back"), "utilities")).toBe(true);
    expect(matchesSearch(card("wells-fargo-active-cash"), "dining")).toBe(false);
  });
});

describe("buildTable", () => {
  const owned = new Set(["capital-one-savor", "citi-double-cash", "amex-gold"]);
  const gold: GoldCard[] = [
    { cardId: "citi-double-cash", categories: ["other"], monthlySpendCents: 50_000 },
    { cardId: "capital-one-savor", categories: ["groceries"], monthlySpendCents: 10_000 },
  ];

  it("orders gold cards by spend won, then other owned cards, then the rest by issuer and popularity", () => {
    const groups = buildTable(CARD_CATALOG, owned, gold, query());
    expect(groups.slice(0, 3).map(group => [group.label, group.cards.map(item => item.id)])).toEqual([
      ["Your best cards", ["citi-double-cash", "capital-one-savor"]],
      ["Your other cards", ["amex-gold"]],
      ["Capital One", ["capital-one-venture-x", "capital-one-quicksilver", "capital-one-venture", "capital-one-savor-student",
        "capital-one-quicksilver-student", "capital-one-ventureone", "capital-one-quicksilverone", "capital-one-quicksilver-secured"]],
    ]);
    expect(ids(groups)).toHaveLength(29);
  });

  it("sorts by popularity without group labels", () => {
    const groups = buildTable(CARD_CATALOG, owned, gold, query({ sort: "popularity" }));
    expect(groups.map(group => group.label)).toEqual([null]);
    expect(ids(groups).slice(0, 6)).toEqual(["citi-double-cash", "capital-one-savor", "amex-gold", "chase-sapphire-preferred", "capital-one-venture-x", "capital-one-quicksilver"]);
  });

  it("filters by ownership, business cards, and search", () => {
    expect(ids(buildTable(CARD_CATALOG, owned, gold, query({ ownership: "mine" })))).toEqual(["citi-double-cash", "capital-one-savor", "amex-gold"]);
    expect(ids(buildTable(CARD_CATALOG, owned, gold, query({ ownership: "not_owned" })))).not.toContain("capital-one-savor");
    expect(ids(buildTable(CARD_CATALOG, owned, gold, query()))).not.toContain("capital-one-spark-cash-plus");
    expect(ids(buildTable(CARD_CATALOG, owned, gold, query({ showBusiness: true })))).toContain("capital-one-spark-cash-plus");
    expect(ids(buildTable(CARD_CATALOG, new Set(["capital-one-spark-cash-plus"]), [], query()))).toContain("capital-one-spark-cash-plus");
    expect(buildTable(CARD_CATALOG, owned, gold, query({ search: "zzz" }))).toEqual([]);
    expect(buildTable(CARD_CATALOG, new Set(), [], query({ ownership: "mine" }))).toEqual([]);
  });
});

describe("topRateChips", () => {
  const NOV = "2026-11-15";

  it("lists the highest bonus rates, rotating ones marked", () => {
    expect(topRateChips(card("discover-it-cash-back"), { today: NOV })).toEqual([
      { category: "dining", rateBps: 500, rotating: true },
      { category: "entertainment", rateBps: 500, rotating: true },
      { category: "utilities", rateBps: 500, rotating: true },
    ]);
    expect(topRateChips(card("discover-it-cash-back"), { today: "2027-01-15" })).toEqual([]);
    expect(topRateChips(card("capital-one-savor"), { today: NOV }).map(chip => chip.category)).toEqual(["travel_portal", "dining", "groceries"]);
  });

  it("shows chosen selectable categories and skips the Amazon fallback", () => {
    expect(topRateChips(card("citi-custom-cash"), { today: NOV, spendProfile: { gas: 100 } })[0]).toEqual({ category: "gas", rateBps: 500, rotating: false });
    expect(topRateChips(card("amex-blue-cash-everyday"), { today: NOV }).map(chip => chip.category)).toEqual(["groceries", "gas", "online_shopping"]);
    expect(topRateChips(card("wells-fargo-active-cash"), { today: NOV })).toEqual([]);
  });
});

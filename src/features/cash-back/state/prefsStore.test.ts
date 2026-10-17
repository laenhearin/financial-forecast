import { describe, expect, it } from "vitest";
import { defaultPrefs, parsePrefs, resolvePrefs } from "./prefsStore";

describe("cash back prefs", () => {
  it("defaults to no saved card list, issuer sort, all cards, and no business cards", () => {
    expect(parsePrefs(null)).toEqual({
      ownedCardIds: null,
      selections: {},
      dismissedSuggestions: [],
      sort: "issuer",
      ownershipFilter: "all",
      showBusiness: false,
    });
    expect(parsePrefs("not json")).toEqual(defaultPrefs());
    expect(parsePrefs("[1, 2]")).toEqual(defaultPrefs());
    expect(parsePrefs("null")).toEqual(defaultPrefs());
  });

  it("keeps a saved card list, even an empty one, and drops ids no longer in the catalog", () => {
    const raw = JSON.stringify({ ownedCardIds: ["citi-double-cash", "everyday-1", 7, "citi-double-cash"], dismissedSuggestions: ["citi-custom-cash", "gone"] });
    expect(parsePrefs(raw)).toMatchObject({ ownedCardIds: ["citi-double-cash"], dismissedSuggestions: ["citi-custom-cash"] });
    expect(parsePrefs(JSON.stringify({ ownedCardIds: [] })).ownedCardIds).toEqual([]);
  });

  it("uses the Nessie card accounts until the user saves a card list", () => {
    const nessieCards = ["capital-one-quicksilver", "amex-blue-cash-everyday"];
    expect(resolvePrefs(parsePrefs(JSON.stringify({ sort: "popularity" })), nessieCards)).toMatchObject({ ownedCardIds: nessieCards, sort: "popularity" });
    expect(resolvePrefs(parsePrefs(JSON.stringify({ ownedCardIds: [] })), nessieCards).ownedCardIds).toEqual([]);
    expect(resolvePrefs(parsePrefs(JSON.stringify({ ownedCardIds: ["citi-double-cash"] })), nessieCards).ownedCardIds).toEqual(["citi-double-cash"]);
  });

  it("keeps only complete, valid picks for user-choice cards", () => {
    const raw = JSON.stringify({
      selections: {
        "bofa-customized-cash": ["gas"],
        "us-bank-cash-plus": ["utilities"],
        "citi-custom-cash": ["groceries"],
        "capital-one-savor": ["dining"],
        nope: ["dining"],
      },
    });
    expect(parsePrefs(raw).selections).toEqual({ "bofa-customized-cash": ["gas"] });
  });

  it("falls back per field on bad values", () => {
    const raw = JSON.stringify({ sort: "random", ownershipFilter: "mine", showBusiness: "yes" });
    expect(parsePrefs(raw)).toMatchObject({ sort: "issuer", ownershipFilter: "mine", showBusiness: false });
  });
});

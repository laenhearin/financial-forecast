import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_OWNED_CARD_IDS } from "../data/demoProfile";
import { defaultPrefs, parsePrefs, prefsStore } from "./prefsStore";

afterEach(() => vi.unstubAllGlobals());

describe("cash back prefs", () => {
  it("uses the selected profile's cards and keeps edits isolated across profiles", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value) } });
    expect(prefsStore.getSnapshot("test-teen", ["capital-one-quicksilver"]).ownedCardIds).toEqual(["capital-one-quicksilver"]);
    prefsStore.update(current => ({ ...current, ownedCardIds: [] }), "test-teen", ["capital-one-quicksilver"]);
    expect(prefsStore.getSnapshot("test-college", ["citi-double-cash"]).ownedCardIds).toEqual(["citi-double-cash"]);
    expect(prefsStore.getSnapshot("test-teen", ["capital-one-quicksilver"]).ownedCardIds).toEqual([]);
  });
  it("defaults to the demo customer's cards, issuer sort, all cards, and no business cards", () => {
    expect(parsePrefs(null)).toEqual({
      ownedCardIds: [...DEMO_OWNED_CARD_IDS],
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

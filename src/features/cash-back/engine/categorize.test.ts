import { describe, expect, it } from "vitest";
import type { Purchase } from "../types";
import { categorize, categorizeByKeyword, normalizeMerchant, unmatchedMerchants } from "./categorize";

const purchase = (id: string, merchant: string): Purchase => ({ id, date: "2026-10-01", merchant, amountCents: 1000, cardId: "everyday-1" });

describe("keyword categorization", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeMerchant("Trader Joe's #512")).toBe("trader joes 512");
    expect(normalizeMerchant("  CHICK-FIL-A  ")).toBe("chick fil a");
  });

  it("matches common merchants", () => {
    expect(categorizeByKeyword("Shell")).toBe("gas");
    expect(categorizeByKeyword("SHELL OIL 57442")).toBe("gas");
    expect(categorizeByKeyword("BP #4411")).toBe("gas");
    expect(categorizeByKeyword("Trader Joe's")).toBe("groceries");
    expect(categorizeByKeyword("Corner Grocery")).toBe("groceries");
    expect(categorizeByKeyword("Satchel's Pizza")).toBe("dining");
    expect(categorizeByKeyword("CVS Pharmacy")).toBe("drugstores");
    expect(categorizeByKeyword("Netflix.com")).toBe("streaming");
  });

  it("checks specific phrases before general ones", () => {
    expect(categorizeByKeyword("Uber Eats")).toBe("dining");
    expect(categorizeByKeyword("Uber Trip")).toBe("travel");
  });

  it("matches whole words only", () => {
    expect(categorizeByKeyword("BPX Outfitters")).toBeNull();
    expect(categorizeByKeyword("Shells Seafood Restaurant")).toBe("dining");
  });

  it("returns null for merchants it doesn't know", () => {
    expect(categorizeByKeyword("Lakeside Bowl")).toBeNull();
    expect(categorizeByKeyword("Home Depot")).toBeNull();
  });
});

describe("categorize", () => {
  const purchases = [purchase("1", "Shell"), purchase("2", "Lakeside Bowl"), purchase("3", "Lakeside Bowl"), purchase("4", "Oak Street Barbers")];

  it("lists unique unmatched merchants in first-seen order", () => {
    expect(unmatchedMerchants(purchases)).toEqual(["Lakeside Bowl", "Oak Street Barbers"]);
  });

  it("uses keywords first, then AI, then falls back to other", () => {
    const result = categorize(purchases, { "Lakeside Bowl": "entertainment", Shell: "dining" });
    expect(result.map(item => [item.category, item.categorySource])).toEqual([
      ["gas", "keyword"],
      ["entertainment", "ai"],
      ["entertainment", "ai"],
      ["other", "fallback"],
    ]);
  });

  it("ignores AI values that are not categories, and prototype keys", () => {
    const weird = JSON.parse('{"Oak Street Barbers": "barbershop"}');
    expect(categorize([purchase("1", "Oak Street Barbers")], weird)[0].category).toBe("other");
    expect(categorize([purchase("2", "constructor"), purchase("3", "__proto__")], {}).map(item => item.category)).toEqual(["other", "other"]);
  });
});

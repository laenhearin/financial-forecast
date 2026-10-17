import { describe, expect, it } from "vitest";
import { MAX_AI_MERCHANTS } from "../config";
import { parseMerchantList, sanitizeClassifications } from "./api";

describe("categorize route input and output", () => {
  it("accepts a bounded list of names, trimmed and de-duplicated", () => {
    expect(parseMerchantList({ merchants: [" Lakeside Bowl ", "Lakeside Bowl", "Home Depot"] })).toEqual(["Lakeside Bowl", "Home Depot"]);
  });

  it("rejects bad input", () => {
    expect(parseMerchantList(null)).toBeNull();
    expect(parseMerchantList({ merchants: [] })).toBeNull();
    expect(parseMerchantList({ merchants: ["ok", 5] })).toBeNull();
    expect(parseMerchantList({ merchants: ["x".repeat(81)] })).toBeNull();
    expect(parseMerchantList({ merchants: Array.from({ length: MAX_AI_MERCHANTS + 1 }, (_, i) => `m${i}`) })).toBeNull();
  });

  it("keeps only requested merchants with valid categories from model output", () => {
    const out = sanitizeClassifications(["Lakeside Bowl", "Duke Energy", "__proto__"], [
      { merchant: "Lakeside Bowl", category: "entertainment" },
      { merchant: "Duke Energy", category: "utilities" },
      { merchant: "Someone Else", category: "gas" },
      { merchant: "__proto__", category: "dining" },
      { merchant: "Lakeside Bowl", category: "bowling" },
      { merchant: "Duke Energy", category: "online" },
      "junk",
    ]);
    expect(Object.keys(out)).toEqual(["Lakeside Bowl", "Duke Energy", "__proto__"]);
    expect(out["Lakeside Bowl"]).toBe("entertainment");
    expect(out["Duke Energy"]).toBe("utilities");
    expect(out["__proto__"]).toBe("dining");
    expect(sanitizeClassifications(["a"], "not an array")).toEqual({});
  });
});

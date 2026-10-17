import { describe, expect, it } from "vitest";
import { stableStringify, toPromptFacts } from "./promptJson";

describe("stableStringify", () => {
  it("ignores object key order at every depth", () => {
    expect(stableStringify({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 3 } })).toBe(stableStringify({ a: { c: 3, d: [{ x: 2, y: 1 }] }, b: 1 }));
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]));
  });
});

describe("toPromptFacts", () => {
  it("turns *Cents keys and bare cents into dollars, leaving everything else", () => {
    expect(toPromptFacts({ amountCents: 123_456, lowest: { date: "2026-01-05", cents: -2_050 }, count: 3, days: [{ endBalanceCents: 100 }] }))
      .toEqual({ amount: 1234.56, lowest: { date: "2026-01-05", amount: -20.5 }, count: 3, days: [{ endBalance: 1 }] });
  });
});

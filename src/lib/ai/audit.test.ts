import { describe, expect, it } from "vitest";
import { auditNumbers } from "./audit";

const facts = { purchase: { amount: 400, label: "Headphones" }, lowestWithPurchase: { amount: 1234.56 }, critical: 1800, levelLabel: "BELOW $0" };

describe("auditNumbers", () => {
  it("passes exact figures, with or without cents and commas", () => {
    expect(auditNumbers("Buying the $400 headphones leaves $1,234.56, above your $1,800 line.", [facts])).toEqual({ ok: true, flags: [] });
    expect(auditNumbers("That's $400.00 and $1800.", [facts]).ok).toBe(true);
  });

  it("passes whole-dollar rounding within 50 cents", () => {
    expect(auditNumbers("Your low point is $1,235.", [facts]).ok).toBe(true);
    expect(auditNumbers("About $1,234.10.", [facts]).ok).toBe(true);
    // Truncating $1,234.56 to $1,234 is 56 cents off, so it is flagged.
    expect(auditNumbers("Your low point is $1,234.", [facts]).ok).toBe(false);
  });

  it("flags an invented figure", () => {
    const result = auditNumbers("You would have $834.56 left, or $1,236.", [facts]);
    expect(result.ok).toBe(false);
    expect(result.flags).toEqual(["unknown amount $834.56", "unknown amount $1,236"]);
  });

  it("ignores numbers without a dollar sign, and allows $0", () => {
    expect(auditNumbers("3 days get worse; 25% less; Oct 24; nothing below $0.", [facts]).ok).toBe(true);
  });

  it("treats negative facts by size and reads numbers inside labels", () => {
    expect(auditNumbers("You'd be $200 overdrawn.", [{ lowest: { amount: -200 } }]).ok).toBe(true);
    expect(auditNumbers("The $85 phone bill is due.", [{ label: "Phone ($85 plan)" }]).ok).toBe(true);
  });

  it("checks amounts written without a dollar sign, and thousands written as k", () => {
    const result = auditNumbers("Your savings will be 15,000 dollars, about USD 2,000 or 300 bucks.", [facts]);
    expect(result.flags).toEqual(["unknown amount 15,000 dollars", "unknown amount USD 2,000", "unknown amount 300 bucks"]);
    expect(auditNumbers("That's 400 dollars, or 1,800 USD.", [facts]).ok).toBe(true);
    expect(auditNumbers("Plan on $1.8k.", [facts]).ok).toBe(true);
    expect(auditNumbers("Plan on $15k.", [facts]).flags).toEqual(["unknown amount $15k"]);
    // One amount written two ways is checked once.
    expect(auditNumbers("It costs $25 USD.", [facts]).flags).toEqual(["unknown amount $25"]);
  });

  it("does not understand context: a known figure attached to the wrong thing still passes", () => {
    // Rent is $1,800 in the facts; calling it the purchase price is wrong, but the number is known.
    expect(auditNumbers("The headphones cost $1,800.", [facts]).ok).toBe(true);
  });

  it("checks several payloads together", () => {
    expect(auditNumbers("$10 and $20", [{ a: 10 }, [{ b: 20 }]]).ok).toBe(true);
    expect(auditNumbers("$10 and $20", [{ a: 10 }]).ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { centsToInputString, dollarsToCents, formatUSD, parseDollarsToCents, percentOfCents, roundDownToStep, roundUpToStep } from "./money";

describe("cents helpers", () => {
  it("converts authored dollars to exact cents", () => {
    expect(dollarsToCents(15.49)).toBe(1549);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents(2450)).toBe(245000);
    expect(() => dollarsToCents(Number.NaN)).toThrow();
    expect(() => dollarsToCents(1e20)).toThrow();
  });

  it("parses typed dollars without floating-point math", () => {
    expect(parseDollarsToCents("1800")).toBe(180000);
    expect(parseDollarsToCents("$1,800.5")).toBe(180050);
    expect(parseDollarsToCents("0.07")).toBe(7);
    expect(parseDollarsToCents(" 12. ")).toBe(1200);
    for (const bad of ["", "-5", "1.234", "1e3", "abc", "12.3.4", "99999999999999999999"]) {
      expect(parseDollarsToCents(bad)).toBeNull();
    }
  });

  it("formats whole dollars without cents and others with cents", () => {
    expect(formatUSD(180000)).toBe("$1,800");
    expect(formatUSD(1549)).toBe("$15.49");
    expect(formatUSD(-500)).toBe("-$5");
    expect(() => formatUSD(1.5)).toThrow();
  });

  it("rounds to contribution steps and percents", () => {
    expect(roundDownToStep(16_499, 500)).toBe(16_000);
    expect(roundUpToStep(16_001, 500)).toBe(16_500);
    expect(percentOfCents(180_000, 15)).toBe(27_000);
    expect(centsToInputString(180_000)).toBe("1800");
    expect(centsToInputString(1_549)).toBe("15.49");
    expect(centsToInputString(1_505)).toBe("15.05");
  });
});

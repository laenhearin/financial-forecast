import { describe, expect, it } from "vitest";
import { addDays, addMonths, clampedDate, dayOfWeek, daysBetween, daysInMonth, formatDate, isISODate, ordinal, toDayNumber, fromDayNumber } from "./dates";

describe("UTC date helpers", () => {
  it("validates real calendar dates only", () => {
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2027-02-29")).toBe(false);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("2026-1-01")).toBe(false);
    expect(isISODate("2026-10-17T00:00:00Z")).toBe(false);
  });

  it("adds days across month, year, and leap-day boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-17", "2027-10-17")).toBe(365);
    expect(daysBetween("2027-10-17", "2028-10-17")).toBe(366);
  });

  it("clamps months to the last day of short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-17", 24)).toBe("2028-10-17");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
    expect(clampedDate(2026, 4, 31)).toBe("2026-04-30");
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it("knows weekdays and round-trips day numbers", () => {
    expect(dayOfWeek("2026-10-17")).toBe(6); // Saturday
    expect(dayOfWeek("2026-10-23")).toBe(5); // Friday
    expect(dayOfWeek("1969-12-31")).toBe(3);
    expect(fromDayNumber(toDayNumber("2026-10-17"))).toBe("2026-10-17");
  });

  it("formats in UTC regardless of the local timezone", () => {
    expect(formatDate("2027-03-14", "long")).toBe("March 14");
    expect(formatDate("2027-01-01", "full")).toBe("January 1, 2027");
    expect(formatDate("2026-12-31", "short")).toBe("Dec 31");
    expect(() => formatDate("2026-02-30")).toThrow();
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 31].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "31st"]);
  });
});

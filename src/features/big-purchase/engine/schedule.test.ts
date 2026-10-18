import { describe, expect, it } from "vitest";
import { occurrences } from "./schedule";

describe("occurrences", () => {
  it("clamps monthly day 31 to the last day of short months", () => {
    expect(occurrences({ frequency: "monthly", dayOfMonth: 31 }, "2028-01-01", "2028-04-30"))
      .toEqual(["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]);
    expect(occurrences({ frequency: "monthly", dayOfMonth: 30 }, "2027-02-01", "2027-02-28")).toEqual(["2027-02-28"]);
  });

  it("steps biweekly across a year boundary and a leap day", () => {
    expect(occurrences({ frequency: "biweekly", anchorDate: "2026-10-23" }, "2026-12-01", "2027-01-31"))
      .toEqual(["2026-12-04", "2026-12-18", "2027-01-01", "2027-01-15", "2027-01-29"]);
    expect(occurrences({ frequency: "biweekly", anchorDate: "2028-02-15" }, "2028-02-01", "2028-03-31"))
      .toEqual(["2028-02-01", "2028-02-15", "2028-02-29", "2028-03-14", "2028-03-28"]);
  });

  it("finds occurrences before a later anchor", () => {
    expect(occurrences({ frequency: "weekly", anchorDate: "2026-11-07" }, "2026-10-17", "2026-11-01"))
      .toEqual(["2026-10-17", "2026-10-24", "2026-10-31"]);
  });

  it("handles semimonthly across a year boundary and a leap February", () => {
    expect(occurrences({ frequency: "semimonthly", dayOfMonth: 15, secondDayOfMonth: 31 }, "2027-12-01", "2028-02-29"))
      .toEqual(["2027-12-15", "2027-12-31", "2028-01-15", "2028-01-31", "2028-02-15", "2028-02-29"]);
  });

  it("deduplicates semimonthly days that clamp to the same date", () => {
    expect(occurrences({ frequency: "semimonthly", dayOfMonth: 30, secondDayOfMonth: 31 }, "2027-02-01", "2027-02-28")).toEqual(["2027-02-28"]);
  });

  it("handles once and yearly schedules, including a February 29 anchor", () => {
    expect(occurrences({ frequency: "once", anchorDate: "2026-12-12" }, "2026-10-17", "2027-10-17")).toEqual(["2026-12-12"]);
    expect(occurrences({ frequency: "once", anchorDate: "2026-12-12" }, "2027-01-01", "2027-10-17")).toEqual([]);
    expect(occurrences({ frequency: "yearly", anchorDate: "2028-02-29" }, "2028-01-01", "2030-12-31"))
      .toEqual(["2028-02-29", "2029-02-28", "2030-02-28"]);
  });

  it("never fires before a startDate, for every frequency", () => {
    // A recurring bill whose first payment is two months away (review test 4).
    expect(occurrences({ frequency: "monthly", dayOfMonth: 1, startDate: "2026-12-01" }, "2026-10-18", "2027-01-31"))
      .toEqual(["2026-12-01", "2027-01-01"]);
    expect(occurrences({ frequency: "biweekly", anchorDate: "2026-10-23", startDate: "2026-11-15" }, "2026-10-18", "2026-12-01"))
      .toEqual(["2026-11-20"]);
    // A startDate already past changes nothing.
    expect(occurrences({ frequency: "monthly", dayOfMonth: 5, startDate: "2026-01-01" }, "2026-10-18", "2026-11-30")).toEqual(["2026-11-05"]);
    expect(() => occurrences({ frequency: "monthly", dayOfMonth: 5, startDate: "12/01/2026" }, "2026-10-18", "2026-11-30")).toThrow();
  });

  it("rejects malformed schedules", () => {
    expect(() => occurrences({ frequency: "monthly", dayOfMonth: 32 }, "2026-01-01", "2026-02-01")).toThrow();
    expect(() => occurrences({ frequency: "monthly" }, "2026-01-01", "2026-02-01")).toThrow();
    expect(() => occurrences({ frequency: "biweekly" }, "2026-01-01", "2026-02-01")).toThrow();
    expect(occurrences({ frequency: "monthly", dayOfMonth: 1 }, "2026-02-01", "2026-01-01")).toEqual([]);
  });
});

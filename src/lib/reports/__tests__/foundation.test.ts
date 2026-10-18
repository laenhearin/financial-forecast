import { describe, expect, it } from "vitest";
import {
  forecastWindow,
  getPreviousRange,
  reportTitle,
  resolveRange,
  validateRange,
} from "../dateRange";
import { maskAccountNumber, safeLabel } from "../masking";
import { DEFAULT_SECTIONS, includedSections } from "../sections";

describe("report calendar dates", () => {
  it.each([
    ["this-month", "2024-02-10", "2024-02-01", "2024-02-29"],
    ["last-month", "2026-01-17", "2025-12-01", "2025-12-31"],
    ["this-year", "2024-02-10", "2024-01-01", "2024-12-31"],
    ["last-year", "2026-01-01", "2025-01-01", "2025-12-31"],
  ] as const)("resolves %s on %s", (preset, today, start, end) =>
    expect(resolveRange(preset, today)).toEqual({ start, end }),
  );
  it("compares calendar months and years, and custom equal lengths", () => {
    expect(
      getPreviousRange(
        { start: "2024-03-01", end: "2024-03-31" },
        "this-month",
      ),
    ).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(
      getPreviousRange(resolveRange("this-year", "2025-02-01"), "this-year"),
    ).toEqual({ start: "2024-01-01", end: "2024-12-31" });
    expect(
      getPreviousRange({ start: "2026-01-01", end: "2026-01-07" }, "custom"),
    ).toEqual({ start: "2025-12-25", end: "2025-12-31" });
  });
  it("rejects reversed, invalid and overlong ranges", () => {
    for (const range of [
      { start: "2026-02-30", end: "2026-03-01" },
      { start: "2026-03-01", end: "2026-01-01" },
      { start: "2024-01-01", end: "2025-01-01" },
    ])
      expect(validateRange(range).valid).toBe(false);
    expect(
      validateRange({ start: "2024-01-01", end: "2024-12-31" }).valid,
    ).toBe(true);
  });
  it("caps forecasts at 31 days, including future-only ranges", () => {
    const today = "2026-10-17";
    expect(
      forecastWindow({ start: "2026-09-01", end: "2026-09-30" }, today),
    ).toBeUndefined();
    expect(forecastWindow({ start: today, end: today }, today)).toEqual({
      start: today,
      end: "2026-10-23",
    });
    expect(forecastWindow(resolveRange("this-year", today), today)?.end).toBe(
      "2026-11-16",
    );
    expect(
      forecastWindow({ start: "2027-01-01", end: "2027-01-31" }, today),
    ).toEqual({ start: today, end: "2026-11-16" });
  });
  it("generates month/year titles from the range, even custom presets", () => {
    expect(reportTitle({ start: "2026-09-01", end: "2026-09-30" })).toBe(
      "Monthly Report: September 2026",
    );
    expect(reportTitle({ start: "2026-01-01", end: "2026-12-31" })).toBe(
      "Annual Report: 2026",
    );
  });
});
it("masks normal, short, empty, and already masked identifiers", () => {
  expect(maskAccountNumber("1234567890")).toBe("****7890");
  expect(maskAccountNumber("1234")).toBe("****");
  expect(maskAccountNumber("")).toBe("****");
  expect(maskAccountNumber("••••1234")).toBe("****1234");
  expect(maskAccountNumber("****1234")).toBe("****1234");
  expect(safeLabel("Checking 1234-5678-9012")).toBe("Checking ****9012");
});
it("uses the six default sections and excludes past forecasts", () => {
  expect(
    includedSections(
      {
        preset: "last-month",
        range: { start: "2026-09-01", end: "2026-09-30" },
        sections: { ...DEFAULT_SECTIONS, forecastCalendar: true },
        compareToPrevious: true,
      },
      "2026-10-17",
    ),
  ).toHaveLength(6);
});

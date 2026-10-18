import { expect, it } from "vitest";
import {
  makeScenario,
  monthlyBill,
  paycheck,
} from "@/features/big-purchase/engine/testScenario";
import { createGoal } from "@/features/big-purchase/state/goalStore";
import { balanceLevel } from "@/features/calendar/engine/balanceThresholds";
import { buildCalendarModel } from "@/features/calendar/engine/model";
import { CARD_CATALOG } from "@/features/cash-back/cards/catalog";
import type { CustomerProfile } from "@/lib/nessie-profile";
import { DEFAULT_SECTIONS } from "../sections";
import { reportFromProfile } from "../profileAdapter";
import type { ReportConfig } from "../types";
const today = "2026-10-17";
const scenario = makeScenario({
  asOfDate: today,
  balanceCents: 10000,
  income: [paycheck(5000, "2026-10-23")],
  bills: [monthlyBill("rent", 9000, 20)],
});
const profile: CustomerProfile = {
  customer: { id: "private-customer-id", name: "Test Person" },
  asOfDate: today,
  sourceLabel: "Test fixture",
  scenario,
  history: [],
  cashBack: {
    customerName: "Test Person",
    asOfDate: today,
    sourceLabel: "Test fixture",
    ownedCardIds: [CARD_CATALOG[0].id],
    spendProfile: {},
  },
};
const config: ReportConfig = {
  preset: "this-month",
  range: { start: "2026-10-01", end: "2026-10-31" },
  sections: Object.fromEntries(
    Object.keys(DEFAULT_SECTIONS).map((id) => [id, true]),
  ) as typeof DEFAULT_SECTIONS,
  compareToPrevious: true,
};
it("reuses calendar balances/weather and labels goal/card data gaps", () => {
  const data = reportFromProfile(profile, config, 5000, {
    goals: [createGoal("g", today, { costCents: 30000, name: "Laptop" })],
  });
  const model = buildCalendarModel(scenario, [], "all");
  expect(data.weatherDays).toHaveLength(15);
  for (const day of data.weatherDays!) {
    expect(day.endBalanceCents).toBe(model.balances.get(day.date)?.totalCents);
    expect(day.level).toBe(balanceLevel(day.endBalanceCents, 5000));
  }
  expect(data.goals?.[0].savedCents).toBeNull();
  expect(data.cards?.[0].spendCents).toBeNull();
  expect(data.bills?.[0]).toMatchObject({
    date: "2026-10-20",
    status: "upcoming",
  });
  expect(JSON.stringify(data)).not.toContain("private-customer-id");
});
it("keeps saved hypotheticals out of baseline totals and uses the advisor engine", () => {
  const data = reportFromProfile(profile, config, 5000, {
    purchases: [
      {
        id: "p",
        accountId: "checking",
        label: "Headphones",
        amountCents: 20000,
        date: "2026-10-18",
      },
    ],
  });
  expect(data.keyNumbers?.spendingCents.current).toBe(0);
  expect(data.advisorSolver?.advisorScenarios).toHaveLength(1);
  expect(
    data.advisorSolver?.advisorScenarios[0].lowestBalanceCents,
  ).toBeLessThan(0);
  expect(
    data.balanceSeries?.find((p) => p.date === "2026-10-18")?.balanceCents,
  ).toBe(10000);
});
it("omits all forecast content for past-only ranges", () => {
  const data = reportFromProfile(
    profile,
    { ...config, range: { start: "2026-09-01", end: "2026-09-30" } },
    5000,
  );
  expect(data.forecastWindow).toBeUndefined();
  expect(data.weatherDays).toBeUndefined();
  expect(data.bills).toEqual([]);
  expect(data.advisorSolver?.guidance).toEqual([]);
  expect(data.includedSections).not.toContain("forecastCalendar");
});

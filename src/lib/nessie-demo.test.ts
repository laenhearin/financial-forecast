import { beforeEach, describe, expect, it, vi } from "vitest";
import plan from "../../data/nessie-demo/plan.json";
import { computeForecast } from "../features/big-purchase/engine/forecast";
import { validateCashBackData } from "../features/cash-back/data/source";
import { seededCashBackProfile } from "../features/cash-back/data/source";
import { buildCalendarModel } from "../features/calendar/engine/model";
import { ALL_ACCOUNTS } from "../features/calendar/types";
import { projectBase } from "../features/big-purchase/engine/base";
import { buildHomeForecast } from "./home-forecast";
import { listNessieDemoProfiles } from "./nessie-demo";
vi.mock("server-only", () => ({}));
const api = vi.hoisted(() => ({ getCustomers: vi.fn(), getCustomerAccounts: vi.fn(),
  getAccountBills: vi.fn(), getAccountDeposits: vi.fn(), getAccountWithdrawals: vi.fn(), getAccountLoans: vi.fn() }));
vi.mock("../nessieApi.js", () => api);
import { loadNessieDemo } from "./nessie-demo";

beforeEach(() => {
  vi.resetAllMocks();
  api.getCustomers.mockResolvedValue(plan.profiles.map(row => ({ _id: row.slug, first_name: "Demo", last_name: row.slug })));
  api.getCustomerAccounts.mockImplementation(async (slug: string) => {
    const profile = plan.profiles.find(row => row.slug === slug)!;
    return [
      { _id: slug, nickname: `${plan.seedId}/${slug}/checking`, balance: profile.checkingCents / 100, type: "Checking" },
      { _id: `${slug}-savings`, nickname: `${plan.seedId}/${slug}/savings`, balance: profile.savingsCents / 100, type: "Savings" },
      ...profile.ownedCardIds.map(card => ({ _id: `${slug}-${card}`, nickname: `${plan.seedId}/${slug}/${card}`, balance: 0, type: "Credit Card" })),
    ];
  });
  for (const kind of ["deposit", "withdrawal"]) {
    (kind === "deposit" ? api.getAccountDeposits : api.getAccountWithdrawals).mockImplementation(async (slug: string) =>
      plan.profiles.find(row => row.slug === slug)!.transactions.filter(tx => tx.kind === kind).map(tx => ({
        _id: tx.key, description: `${plan.seedId}/${tx.key} | SYNTHETIC | ${tx.label}`,
        amount: tx.amountCents / 100, status: "completed", transaction_date: tx.date,
      })));
  }
  api.getAccountBills.mockImplementation(async (slug: string) => plan.profiles.find(row => row.slug === slug)!.bills.map(bill => ({
    _id: `${slug}-${bill.label}`, nickname: `${plan.seedId}/${slug}/${bill.label}`, payment_amount: bill.amountCents / 100,
    status: "recurring", recurring_date: bill.recurringDay, payment_date: bill.paymentDate,
  })));
  api.getAccountLoans.mockImplementation(async (slug: string) => {
    const loan = plan.profiles.find(row => row.slug === slug)!.loan;
    return loan ? [{ _id: `${slug}-loan`, description: `${plan.seedId}/${slug}/loan | SYNTHETIC | ${loan.label}`,
      amount: loan.amountCents / 100, monthly_payment: loan.monthlyPaymentCents / 100, status: "approved" }] : [];
  });
});

describe("seeded UI adapter", () => {
  it("provides all eight feature inputs without replaying posted history into forecasts", async () => {
    for (const profile of plan.profiles) {
      const data = await loadNessieDemo(profile.slug);
      expect(data.isFixture).toBe(true);
      expect(data.history).toHaveLength(4);
      expect(data.cashBack.purchases).toHaveLength(3);
      expect(validateCashBackData(data.cashBack)).toEqual([]);
      expect(data.scenario.accounts[0].balanceCents).toBe(profile.checkingCents);
      expect(data.scenario.oneOffs).toEqual([]);
      expect(data.goal.status).toBe("draft");
      expect(seededCashBackProfile(data.cashBack)).toMatchObject({ customerName: profile.label, spendProfile: profile.monthlySpendingByCategory });
      const result = computeForecast(data.scenario, data.goal);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.forecast.plan.affordableNow).toBe(["midlife", "older"].includes(profile.slug));
    }
  });
  it("offers all eight profiles in the dropdown", () => {
    expect(listNessieDemoProfiles().map(profile => profile.slug)).toEqual(plan.profiles.map(profile => profile.slug));
    expect(listNessieDemoProfiles()).toHaveLength(8);
  });
  it("keeps the teen above zero but repeatedly below $100, with consistent page forecasts", async () => {
    const { scenario } = await loadNessieDemo("teen-low-cash");
    const base = projectBase(scenario).days.slice(0, 31);
    const calendar = buildCalendarModel(scenario, [], ALL_ACCOUNTS);
    const home = buildHomeForecast(scenario);
    expect(base.filter(day => day.baseCents < 10000).length).toBeGreaterThanOrEqual(7);
    expect(Math.min(...base.map(day => day.baseCents))).toBeGreaterThanOrEqual(0);
    for (const [index, day] of base.entries()) {
      expect(calendar.balances.get(day.date)?.totalCents).toBe(day.baseCents);
      expect(home.projection[index].balanceCents).toBe(day.baseCents);
    }
  });
  it("shows a future shortfall and a payday recovery for the new college profile", async () => {
    const { scenario } = await loadNessieDemo("college-shortfall");
    const model = buildCalendarModel(scenario, [], ALL_ACCOUNTS);
    expect(model.startingCents).toBe(25000);
    const negative = [...model.balances.entries()].find(([, balance]) => balance.totalCents < 0);
    expect(negative?.[0]).toBe("2026-10-22");
    expect(model.balances.get("2026-10-30")!.totalCents).toBe(2577);
    expect(model.balances.get("2026-10-31")!.totalCents).toBeLessThan(0);
    expect(model.balances.get("2026-11-13")!.totalCents).toBeGreaterThan(0);
  });
  it("shows existing debt separately and includes its payment exactly once", async () => {
    const { scenario } = await loadNessieDemo("existing-debt");
    expect(scenario.debts?.[0]).toMatchObject({ balanceCents: 150000, monthlyPaymentCents: 7500 });
    const calendar = buildCalendarModel(scenario, [], ALL_ACCOUNTS);
    expect(calendar.startingCents).toBe(6000);
    expect(calendar.startingCents - scenario.debts![0].balanceCents).toBe(-144000);
    const payments = calendar.entries.filter(entry => entry.date === "2026-10-22" && entry.label === "Loan payment");
    expect(payments).toHaveLength(1);
    expect(payments[0].amountCents).toBe(7500);
    api.getAccountLoans.mockResolvedValue([]);
    await expect(loadNessieDemo("existing-debt")).rejects.toThrow("Expected one seeded record");
  });
  it("fails visibly when expected history is missing instead of quietly using local amounts", async () => {
    api.getAccountWithdrawals.mockResolvedValue([]);
    await expect(loadNessieDemo()).rejects.toThrow("Expected one seeded record");
  });
  it("propagates upstream failures and rejects unknown profiles", async () => {
    api.getCustomers.mockRejectedValue(new Error("Nessie HTTP 401"));
    await expect(loadNessieDemo()).rejects.toThrow("Nessie HTTP 401");
    await expect(loadNessieDemo("unknown")).rejects.toThrow("Unknown demo profile");
  });
});

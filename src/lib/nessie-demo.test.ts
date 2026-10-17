import { beforeEach, describe, expect, it, vi } from "vitest";
import plan from "../../data/nessie-demo/plan.json";
import { computeForecast } from "../features/big-purchase/engine/forecast";
import { validateCashBackData } from "../features/cash-back/data/source";
vi.mock("server-only", () => ({}));
const api = vi.hoisted(() => ({ getCustomers: vi.fn(), getCustomerAccounts: vi.fn(),
  getAccountBills: vi.fn(), getAccountDeposits: vi.fn(), getAccountWithdrawals: vi.fn() }));
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
});

describe("seeded UI adapter", () => {
  it("provides all five feature inputs without replaying posted history into forecasts", async () => {
    for (const profile of plan.profiles) {
      const data = await loadNessieDemo(profile.slug);
      expect(data.isFixture).toBe(true);
      expect(data.history).toHaveLength(4);
      expect(data.cashBack.purchases).toHaveLength(3);
      expect(validateCashBackData(data.cashBack)).toEqual([]);
      expect(data.scenario.accounts[0].balanceCents).toBe(profile.checkingCents);
      expect(data.scenario.oneOffs).toEqual([]);
      expect(data.goal.status).toBe("draft");
      const result = computeForecast(data.scenario, data.goal);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.forecast.plan.affordableNow).toBe(["midlife", "older"].includes(profile.slug));
    }
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

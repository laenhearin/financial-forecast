import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectBase } from "../features/big-purchase/engine/base";
import { computeForecast } from "../features/big-purchase/engine/forecast";
import { ScenarioLoadError } from "../data/dataSource";
vi.mock("server-only", () => ({}));
const api = vi.hoisted(() => ({
  getCustomers: vi.fn(), getCustomerAccounts: vi.fn(),
  getAccountDeposits: vi.fn(), getAccountWithdrawals: vi.fn(), getAccountBills: vi.fn(), getAccountLoans: vi.fn(),
}));
vi.mock("./nessie-api", () => api);
import { buildCustomerProfile, displayLabel, listNessieCustomers, loadCustomerProfile } from "./nessie-profile";

// Shapes copied from live GET responses on 2026-10-17 (the seeded college customer).
const CUSTOMER = { id: "6a081f7d-fc98-4b9c-9982-043bc5294ffd", name: "string string" };
const CHECKING = "8f61623b-28a7-4430-ba4f-7b4e15c9e844";
const SAVINGS = "79865efa-5b54-42ac-8d0b-ae063b124b4e";
const TODAY = "2026-10-17";
const accounts = () => [
  { _id: SAVINGS, type: "Savings", nickname: "ff-demo-v1/college/savings", rewards: 0, balance: 400, account_number: "2519511379254813", customer_id: CUSTOMER.id },
  { _id: "4a1ebb9b-d693-4971-a4c9-b2c5847f3075", type: "Credit Card", nickname: "ff-demo-v1/college/market-fresh", rewards: 0, balance: 0, customer_id: CUSTOMER.id },
  { _id: CHECKING, type: "Checking", nickname: "ff-demo-v1/college/checking", rewards: 0, balance: 350, account_number: "3547587001927779", customer_id: CUSTOMER.id },
  { _id: "e52c6f33-ea37-44c2-b10c-76aff3ade569", type: "Credit Card", nickname: "ff-demo-v1/college/everyday-1", rewards: 0, balance: 0, customer_id: CUSTOMER.id },
];
const deposit = (id: string, date: string, amount: number, description: string, status = "completed") =>
  ({ _id: id, medium: "balance", transaction_date: date, status, amount, description });
const withdrawal = (id: string, date: string, amount: number, description: string, status = "completed") =>
  ({ _id: id, type: "withdrawal", transaction_date: date, status, payer_id: CHECKING, medium: "balance", amount, description });
const bill = (id: string, fields: Record<string, unknown>) =>
  ({ _id: id, status: "recurring", payee: "Demo housing provider", creation_date: TODAY, account_id: CHECKING, ...fields });

const deposits = () => [deposit("d1", "2026-07-21", 650, "ff-demo-v1/college-1 | SYNTHETIC | Campus library paycheck")];
const withdrawals = () => [
  withdrawal("w2", "2026-08-13", 92, "ff-demo-v1/college-2 | SYNTHETIC | Publix groceries"),
  withdrawal("w3", "2026-09-15", 145, "ff-demo-v1/college-3 | SYNTHETIC | Campus bookstore textbooks"),
  withdrawal("w4", "2026-10-12", 28, "ff-demo-v1/college-4 | SYNTHETIC | Chipotle dinner with friends"),
];
const bills = () => [
  bill("b-util", { payee: "Demo utilities provider", nickname: "ff-demo-v1/college/Utilities and internet", payment_date: "2026-10-24", recurring_date: 24, upcoming_payment_date: "2026-10-24", payment_amount: 60 }),
  bill("b-home", { nickname: "ff-demo-v1/college/Housing", payment_date: "2026-11-01", recurring_date: 1, upcoming_payment_date: "2026-11-01", payment_amount: 650 }),
];
const raw = (overrides: Partial<{ deposits: object[]; withdrawals: object[]; bills: object[]; accounts: object[] }> = {}) => ({
  customer: CUSTOMER,
  accounts: (overrides.accounts ?? accounts()) as never,
  activity: [{
    accountId: CHECKING,
    deposits: (overrides.deposits ?? deposits()) as never,
    withdrawals: (overrides.withdrawals ?? withdrawals()) as never,
    bills: (overrides.bills ?? bills()) as never,
  }],
});

beforeEach(() => {
  vi.resetAllMocks();
  api.getCustomers.mockResolvedValue([{ _id: CUSTOMER.id, first_name: "string", last_name: "string", address: {} }]);
  api.getCustomerAccounts.mockResolvedValue(accounts());
  api.getAccountDeposits.mockImplementation(async (id: string) => (id === CHECKING ? deposits() : []));
  api.getAccountWithdrawals.mockImplementation(async (id: string) => (id === CHECKING ? withdrawals() : []));
  api.getAccountBills.mockImplementation(async (id: string) => (id === CHECKING ? bills() : []));
  api.getAccountLoans.mockResolvedValue([]);
});

describe("Nessie customer profile", () => {
  it("reads balances, bills, and history from Nessie, converting dollars to cents once", async () => {
    const profile = await loadCustomerProfile(CUSTOMER, TODAY);
    expect(profile.customer).toEqual(CUSTOMER);
    expect(profile.scenario.customerName).toBe("string string");
    expect(profile.scenario.asOfDate).toBe(TODAY);
    // Checking first, whatever order Nessie lists them in.
    expect(profile.scenario.accounts).toEqual([
      { id: CHECKING, nickname: "Checking", type: "checking", balanceCents: 35_000, includeInForecast: true },
      { id: SAVINGS, nickname: "Savings", type: "savings", balanceCents: 40_000, includeInForecast: true },
    ]);
    expect(profile.scenario.bills.map(({ id, label, amountCents, schedule, category }) => ({ id, label, amountCents, schedule, category }))).toEqual([
      { id: "b-util", label: "Utilities and internet", amountCents: 6_000, schedule: { frequency: "monthly", dayOfMonth: 24 }, category: "utilities" },
      { id: "b-home", label: "Housing", amountCents: 65_000, schedule: { frequency: "monthly", dayOfMonth: 1 }, category: "housing" },
    ]);
    expect(profile.history.map(row => [row.kind, row.date, row.amountCents, row.label])).toEqual([
      ["deposit", "2026-07-21", 65_000, "Campus library paycheck"],
      ["withdrawal", "2026-08-13", 9_200, "Publix groceries"],
      ["withdrawal", "2026-09-15", 14_500, "Campus bookstore textbooks"],
      ["withdrawal", "2026-10-12", 2_800, "Chipotle dinner with friends"],
    ]);
    expect(profile.scenario.oneOffs).toEqual([]);
  });

  it("reads activity only for checking and savings accounts", async () => {
    await loadCustomerProfile(CUSTOMER, TODAY);
    expect(api.getCustomerAccounts).toHaveBeenCalledWith(CUSTOMER.id);
    for (const fn of [api.getAccountDeposits, api.getAccountWithdrawals, api.getAccountBills, api.getAccountLoans]) {
      expect(fn.mock.calls.map(([id]) => id).sort()).toEqual([CHECKING, SAVINGS].sort());
    }
  });

  it("uses the seeded customer's plan income, spending, and category budget, matched by account nickname", async () => {
    const { scenario, cashBack } = await loadCustomerProfile({ ...CUSTOMER, name: "College student" }, TODAY);
    expect(scenario.customerName).toBe("College student");
    expect(scenario.income).toEqual([{
      id: "plan-income", label: "Paycheck (plan)", amountCents: 65_000,
      schedule: { frequency: "biweekly", anchorDate: "2026-10-23" }, isPaycheck: true,
    }]);
    expect(scenario.spending).toEqual([{
      id: "plan-spending", label: "Everyday spending (plan)", monthlyAmountCents: 32_000, cuttable: true, maxCutPercent: 25,
    }]);
    expect(cashBack.spendProfile).toEqual({ groceries: 18_000, dining: 6_000, transit: 4_000, other: 4_000 });
    // Balances and bills still come from Nessie, not from the plan.
    expect(scenario.accounts.map(account => account.balanceCents)).toEqual([35_000, 40_000]);
    expect(scenario.bills.map(bill => bill.amountCents)).toEqual([6_000, 65_000]);
  });

  it("falls back to Nessie-history estimates for a customer without a plan entry", async () => {
    api.getCustomerAccounts.mockResolvedValue(accounts().map(account => ({ ...account, nickname: account.nickname.replace("ff-demo-v1/college/", "") })));
    const { scenario } = await loadCustomerProfile(CUSTOMER, TODAY);
    expect(scenario.income[0].id).toBe("nessie-estimated-income");
    expect(scenario.spending[0].id).toBe("nessie-estimated-spending");
  });

  it("reads approved Nessie loans as debt, separate from cash", () => {
    const loan = (status: string) => ({ _id: `loan-${status}`, type: "personal", status, credit_score: 620, monthly_payment: 75, amount: 1500,
      description: "ff-demo-v1/existing-debt/loan | SYNTHETIC | Existing personal loan" });
    const base = raw();
    const { scenario } = buildCustomerProfile({ ...base, activity: [{ ...base.activity[0], loans: [loan("approved"), loan("declined")] as never }] }, TODAY);
    expect(scenario.debts).toEqual([{ id: "loan-approved", label: "Existing personal loan", balanceCents: 150_000, monthlyPaymentCents: 7_500 }]);
    expect(projectBase(scenario).startingCashCents).toBe(75_000);
  });

  it("estimates income from the latest deposit and spending from the last 90 days of withdrawals", () => {
    const { scenario } = buildCustomerProfile(raw(), TODAY);
    expect(scenario.income).toEqual([{
      id: "nessie-estimated-income", label: "Campus library paycheck (estimate)", amountCents: 65_000,
      schedule: { frequency: "monthly", dayOfMonth: 21 }, isPaycheck: true,
    }]);
    // (9,200 + 14,500 + 2,800) / 3, rounded to whole cents.
    expect(scenario.spending).toEqual([{
      id: "nessie-estimated-spending", label: "Everyday spending (estimate)", monthlyAmountCents: 8_833, cuttable: true, maxCutPercent: 25,
    }]);
  });

  it("uses an inclusive 90-day window and ignores records that are not completed or not yet dated", () => {
    const { scenario, history } = buildCustomerProfile(raw({
      deposits: [deposit("d-old", "2026-06-01", 500, "Old paycheck"), deposit("d-new", "2026-10-01", 700, "New paycheck"), deposit("d-pending", "2026-10-10", 900, "Pending", "pending")],
      withdrawals: [
        withdrawal("w-in", "2026-07-20", 30, "Day 89: inside"),
        withdrawal("w-out", "2026-07-19", 3_000, "Day 90: outside"),
        withdrawal("w-future", "2026-10-18", 4_000, "Tomorrow"),
        withdrawal("w-cancelled", "2026-10-01", 5_000, "Cancelled", "cancelled"),
      ],
    }), TODAY);
    expect(scenario.spending[0].monthlyAmountCents).toBe(1_000);
    expect(scenario.income[0]).toMatchObject({ amountCents: 70_000, schedule: { frequency: "monthly", dayOfMonth: 1 } });
    expect(history.map(row => row.id)).toEqual(["d-old", "w-out", "w-in", "d-new"]);
  });

  it("starts the forecast from the Nessie balances without replaying posted history", () => {
    const { scenario } = buildCustomerProfile(raw(), TODAY);
    const base = projectBase(scenario);
    expect(base.startingCashCents).toBe(75_000);
    const result = computeForecast(scenario, { costCents: 50_000, bufferCents: 20_000, contributionCents: null });
    expect(result.ok).toBe(true);
  });

  it("builds Cash Back from the credit card accounts and categorized withdrawals", () => {
    const { cashBack } = buildCustomerProfile(raw(), TODAY);
    // market-fresh and everyday-1 are the seed's sample ids for these catalog cards.
    expect([...cashBack.ownedCardIds].sort()).toEqual(["amex-blue-cash-everyday", "capital-one-quicksilver"]);
    expect(cashBack.spendProfile).toEqual({ groceries: 3_067, other: 4_833, dining: 933 });
    expect(cashBack).toMatchObject({ customerName: "string string", asOfDate: TODAY, sourceLabel: "Nessie sandbox" });
  });

  it("schedules recurring and future pending bills and skips the rest", () => {
    const { scenario } = buildCustomerProfile(raw({ bills: [
      bill("recurring", { nickname: "Rent", payment_date: "2026-11-01", recurring_date: 31, payment_amount: 12.5 }),
      bill("pending-future", { status: "pending", payee: "Demo DMV", nickname: "Car registration", payment_date: "2026-12-12", payment_amount: 260 }),
      bill("pending-past", { status: "pending", nickname: "Old fee", payment_date: TODAY, payment_amount: 10 }),
      bill("done", { status: "completed", nickname: "Paid", payment_date: "2026-10-01", payment_amount: 10 }),
      bill("stopped", { status: "cancelled", nickname: "Gym", payment_date: "2026-11-03", recurring_date: 3, payment_amount: 45 }),
    ] }), TODAY);
    expect(scenario.bills.map(({ id, amountCents, schedule, category }) => ({ id, amountCents, schedule, category }))).toEqual([
      { id: "recurring", amountCents: 1_250, schedule: { frequency: "monthly", dayOfMonth: 31 }, category: "housing" },
      { id: "pending-future", amountCents: 26_000, schedule: { frequency: "once", anchorDate: "2026-12-12" }, category: "transport" },
    ]);
  });

  it("stops on records that do not match the observed schema", () => {
    expect(() => buildCustomerProfile(raw({ bills: [bill("x", { status: "paused", payment_amount: 1 })] }), TODAY)).toThrow("unexpected status");
    expect(() => buildCustomerProfile(raw({ bills: [bill("x", { recurring_date: 0, payment_amount: 1 })] }), TODAY)).toThrow("invalid recurring_date");
    expect(() => buildCustomerProfile(raw({ withdrawals: [withdrawal("x", "10/12/2026", 5, "Bad date")] }), TODAY)).toThrow("invalid transaction_date");
    expect(() => buildCustomerProfile(raw({ withdrawals: [withdrawal("x", TODAY, -5, "Negative")] }), TODAY)).toThrow("invalid amount");
    expect(() => buildCustomerProfile(raw({ accounts: [{ _id: "a", type: "Brokerage", balance: 1 }] }), TODAY)).toThrow("unexpected type");
    expect(() => buildCustomerProfile(raw({ accounts: [{ _id: "a", type: "Checking", balance: "350" }] }), TODAY)).toThrow("invalid balance");
  });

  it("loads a customer without deposits with no income, and reports a broken scenario with details", () => {
    expect(buildCustomerProfile(raw({ deposits: [] }), TODAY).scenario.income).toEqual([]);
    const broken = raw({ bills: [bill("dup", { payment_amount: 1, recurring_date: 1 }), bill("dup", { payment_amount: 2, recurring_date: 2 })] });
    expect(() => buildCustomerProfile(broken, TODAY)).toThrow(ScenarioLoadError);
  });

  it("propagates Nessie failures instead of substituting other data", async () => {
    api.getCustomerAccounts.mockRejectedValue(new Error("Nessie HTTP 401 (GET). Upstream body withheld to protect credentials."));
    await expect(loadCustomerProfile(CUSTOMER, TODAY)).rejects.toThrow("Nessie HTTP 401");
  });

  it("lists customers by their Nessie names", async () => {
    api.getCustomers.mockResolvedValue([
      { _id: "c1", first_name: "Demo-midlife", last_name: "ff-demo-v1" },
      { _id: "c2", first_name: "", last_name: "" },
    ]);
    expect(await listNessieCustomers()).toEqual([{ id: "c1", name: "Demo-midlife ff-demo-v1" }, { id: "c2", name: "Nessie customer" }]);
  });

  it("strips only the seed's idempotency markers from labels", () => {
    expect(displayLabel("ff-demo-v1/college/Housing")).toBe("Housing");
    expect(displayLabel("ff-demo-v1/college-2 | SYNTHETIC | Publix groceries")).toBe("Publix groceries");
    expect(displayLabel("ff-demo-v1/college/checking")).toBe("Checking");
    expect(displayLabel("Coffee | Downtown")).toBe("Coffee | Downtown");
    expect(displayLabel("  Financial Forecast Demo ")).toBe("Financial Forecast Demo");
  });
});

import "server-only";
import plan from "../../data/nessie-demo/plan.json" with { type: "json" };
import { getCustomers, getCustomerAccounts, getAccountBills, getAccountDeposits, getAccountWithdrawals, getAccountLoans } from "../nessieApi.js";
import type { NessieRecord } from "./nessie-api";
import type { Scenario, Goal } from "../features/big-purchase/types";
import type { CashBackData } from "../features/cash-back/data/source";

function cents(value: unknown): number {
  // This is the explicit convention of OUR tagged seed, not a general Nessie unit claim.
  if (typeof value !== "number" || value < 0 || !Number.isSafeInteger(value * 100)) {
    throw new Error("Expected a nonnegative monetary value on a seeded Nessie record.");
  }
  return value * 100;
}
function one(rows: NessieRecord[], field: string, value: string): NessieRecord {
  const matches = rows.filter(row => row[field] === value);
  if (matches.length !== 1) throw new Error(`Expected one seeded record for ${value}; found ${matches.length}.`);
  return matches[0];
}

/**
 * Read-only adapter for ff-demo-v1 ONLY. Always label it as a fixture.
 * API provides balances, bills and transaction amounts/dates. The plan provides
 * synthetic card assignments, future income/spending assumptions, and hypothetical goals.
 * The selected demo-profile cookie drives the server routes and pages that call this adapter.
 * Call from a server route/component only.
 */
export async function loadNessieDemo(slug = "college") {
  const profile = plan.profiles.find(row => row.slug === slug);
  if (!profile) throw new Error(`Unknown demo profile. Choose ${plan.profiles.map(row => row.slug).join(", ")}.`);
  const customers = await getCustomers();
  const candidates = await Promise.all(customers.map(async customer => ({
    customer, accounts: await getCustomerAccounts(customer._id),
  })));
  const prefix = `${plan.seedId}/${slug}/`;
  const owners = candidates.filter(owner => owner.accounts.some(row => row.nickname === `${prefix}checking`));
  if (owners.length !== 1) throw new Error(`Expected one customer with ${prefix}checking. Apply the seed once with this key.`);
  const { customer, accounts } = owners[0];
  const checking = one(accounts, "nickname", `${prefix}checking`);
  const savings = one(accounts, "nickname", `${prefix}savings`);
  for (const cardId of profile.ownedCardIds) {
    if (one(accounts, "nickname", `${prefix}${cardId}`).type !== "Credit Card") {
      throw new Error(`Seeded account ${cardId} must have type Credit Card.`);
    }
  }
  const [deposits, withdrawals, bills] = await Promise.all([
    getAccountDeposits(checking._id), getAccountWithdrawals(checking._id), getAccountBills(checking._id),
  ]);
  const history = profile.transactions.map(transaction => {
    const description = `${plan.seedId}/${transaction.key} | SYNTHETIC | ${transaction.label}`;
    const row = one(transaction.kind === "deposit" ? deposits : withdrawals, "description", description);
    if (row.status !== "completed" || row.transaction_date !== transaction.date || cents(row.amount) !== transaction.amountCents) {
      throw new Error(`Seeded history ${transaction.key} changed; reconcile the fixture before using it.`);
    }
    return { id: row._id, kind: transaction.kind, date: transaction.date,
      amountCents: cents(row.amount), label: transaction.label, cardId: transaction.cardId };
  });
  const debts: NonNullable<Scenario["debts"]> = [];
  if (profile.loan) {
    const loan = profile.loan;
    const row = one(await getAccountLoans(checking._id), "description", `${plan.seedId}/${slug}/loan | SYNTHETIC | ${loan.label}`);
    if (row.status !== "approved" || cents(row.amount) !== loan.amountCents || cents(row.monthly_payment) !== loan.monthlyPaymentCents) {
      throw new Error("Seeded loan changed; reconcile its debt balance and payment before forecasting.");
    }
    const payment = profile.bills.find(bill => bill.label === loan.paymentBillLabel);
    if (!payment || payment.amountCents !== cents(row.monthly_payment)) throw new Error("Seeded loan needs a matching payment schedule.");
    debts.push({ id: row._id, label: loan.label, balanceCents: cents(row.amount), monthlyPaymentCents: cents(row.monthly_payment) });
  }
  const cashBack: CashBackData = {
    customerName: profile.label, asOfDate: plan.asOfDate, ownedCardIds: profile.ownedCardIds,
    spendProfile: profile.monthlySpendingByCategory,
    purchases: history.filter(row => row.kind === "withdrawal").map(row => ({
      id: row.id, date: row.date, merchant: row.label, amountCents: row.amountCents, cardId: row.cardId!,
    })),
  };
  const scenario: Scenario = {
    id: `${plan.seedId}/${slug}`, label: "Synthetic Nessie demo", customerName: profile.label,
    asOfDate: plan.asOfDate,
    accounts: [
      { id: checking._id, nickname: "Demo checking", type: "checking", balanceCents: cents(checking.balance), includeInForecast: true },
      { id: savings._id, nickname: "Demo savings", type: "savings", balanceCents: cents(savings.balance), includeInForecast: true },
    ],
    income: [{ id: `${slug}-future-income`, label: `${profile.income.label} (demo assumption)`, amountCents: profile.income.amountCents,
      schedule: profile.income.frequency === "monthly"
        ? { frequency: "monthly", dayOfMonth: Number(profile.income.anchorDate.slice(8)) }
        : { frequency: "biweekly", anchorDate: profile.income.anchorDate }, isPaycheck: true }],
    bills: profile.bills.map(bill => {
      const row = one(bills, "nickname", `${prefix}${bill.label}`);
      if (row.status !== "recurring" || row.recurring_date !== bill.recurringDay || row.payment_date !== bill.paymentDate) {
        throw new Error(`Seeded bill ${bill.label} changed; reconcile its schedule before forecasting.`);
      }
      return { id: row._id, label: bill.label, amountCents: cents(row.payment_amount),
        schedule: { frequency: "monthly" as const, dayOfMonth: bill.recurringDay },
        category: "category" in bill ? bill.category : (bill.label === "Housing" ? "housing" : "utilities"), cancellable: false, shiftable: false };
    }),
    spending: [{ id: `${slug}-everyday`, label: "Everyday spending (demo estimate)",
      monthlyAmountCents: profile.estimatedMonthlySpendingCents, cuttable: true, maxCutPercent: 25 }],
    // Posted history is already represented by the end-of-day balance, never replayed into the forecast.
    oneOffs: [],
    debts,
  };
  const goal: Goal = { id: `${slug}-hypothetical-goal`, ...profile.goal, bufferIsCustom: true, priority: 1,
    status: "draft", contributionCents: null, createdAt: plan.asOfDate, updatedAt: plan.asOfDate };
  return {
    sourceLabel: "Synthetic Nessie data + local demo assumptions", isFixture: true as const,
    asOfDate: plan.asOfDate,
    customer: { id: customer._id, firstName: customer.first_name, lastName: customer.last_name },
    cashBack, scenario, goal, history,
    notes: [
      "These are synthetic demo profiles, not statements about the named customers' actual ages or finances.",
      "Cash-back purchases are a demo projection of seeded withdrawals, not native Nessie purchase or card-charge records.",
      "Card assignments, reward rules, future income/spending, and goals are local fixtures; history is sparse.",
      "Balances are snapshots as of 2026-10-17; the seed did not cause balances to change on transaction creation.",
      "Seed loan amount represents outstanding principal at this snapshot. Only scheduled loan payments reduce forecast cash; interest and amortization are not modeled.",
    ],
  };
}

/** Safe profile metadata for the client-side demo user picker. */
export function listNessieDemoProfiles() {
  return plan.profiles.map(({ slug, label, bills }) => ({
    slug,
    label,
    criticalBalanceDefaultCents: bills.find((bill) => /housing|rent/i.test(bill.label))?.amountCents ?? 0,
  }));
}

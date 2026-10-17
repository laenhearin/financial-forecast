/** Node 24: node --conditions=react-server --env-file=.env.local scripts/seed-nessie.mts [--apply] */
import { readFile, writeFile, open, unlink } from "node:fs/promises";
import {
  getCustomers, createCustomer, getCustomerAccounts, createAccount,
  getAccountDeposits, getAccountWithdrawals, createDeposit, createWithdrawal,
  getAccountBills, createBill,
} from "../src/nessieApi.js";
import type { NessieRecord, NessieAccountType } from "../src/lib/nessie-api";

type Transaction = { key: string; kind: "deposit" | "withdrawal"; date: string; amountCents: number; label: string; cardId?: string };
interface Profile {
  slug: string; label: string; checkingCents: number; savingsCents: number; ownedCardIds: string[];
  income: { label: string; amountCents: number; frequency: string; anchorDate: string };
  bills: { label: string; payee: string; amountCents: number; paymentDate: string; recurringDay: number }[];
  estimatedMonthlySpendingCents: number;
  goal: { name: string; costCents: number; bufferCents: number; preferredDeadline: string };
  transactions: Transaction[];
}
interface SeedPlan { seedId: string; asOfDate: string; windowStart: string; isFixture: boolean; moneyConvention: string; profiles: Profile[] }
interface ProfileReceipt {
  slug: string; customerId: string;
  accounts: { id: string; role: string; balanceRaw: number }[];
  transactions: { key: string; id: string; kind: string; amountCents: number; date: string }[];
  bills: { id: string; label: string; amountCents: number; paymentDate: string }[];
}
interface Receipt { seedId: string; asOfDate: string; isFixture: true; profiles: ProfileReceipt[]; verifiedAt?: string }

const root = new URL("../data/nessie-demo/", import.meta.url);
const receiptURL = new URL("receipt.local.json", root);
const lockURL = new URL("seed.local.lock", root);
const plan = JSON.parse(await readFile(new URL("plan.json", root), "utf8")) as SeedPlan;
const apply = process.argv.slice(2).includes("--apply");
if (process.argv.slice(2).some(arg => arg !== "--apply")) throw new Error("Usage: scripts/seed-nessie.mts [--apply]");

function units(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents % 100 !== 0) {
    throw new Error("Seed amounts must be nonnegative integer cents in whole dollars (Nessie integer fields).");
  }
  return cents / 100;
}
function unique(rows: NessieRecord[], field: string, value: string): NessieRecord | undefined {
  const matches = rows.filter(row => row[field] === value);
  if (matches.length > 1) throw new Error(`Duplicate seed marker ${value}; resolve before continuing.`);
  return matches[0];
}
function verify(row: NessieRecord, expected: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(expected)) {
    if (row[key] !== value) throw new Error(`Read-back mismatch for ${row._id}: ${key}. Existing records were not overwritten.`);
  }
}

async function main() {
  if (!apply) {
    console.log(JSON.stringify({ mode: "preview: no API calls or writes", ...plan }, null, 2));
    console.log("Run with --apply to seed. Only one teammate should apply this shared dataset.");
    return;
  }
  const lock = await open(lockURL, "wx");
  try {
    let receipt: Receipt;
    try { receipt = JSON.parse(await readFile(receiptURL, "utf8")) as Receipt; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      receipt = { seedId: plan.seedId, asOfDate: plan.asOfDate, isFixture: true, profiles: [] };
    }
    if (receipt.seedId !== plan.seedId || receipt.asOfDate !== plan.asOfDate) throw new Error("Receipt does not match this fixed seed plan.");
    const save = () => writeFile(receiptURL, JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
    let customers = await getCustomers();
    if (!receipt.profiles.length) {
      // Recover remote markers first so a teammate without our receipt does not assign
      // personas again using a different customer-list order.
      const inventories = await Promise.all(customers.map(async customer => ({
        customer, accounts: await getCustomerAccounts(customer._id),
      })));
      for (const profile of plan.profiles) {
        const owners = inventories.filter(({ customer, accounts }) =>
          accounts.some(row => row.nickname === `${plan.seedId}/${profile.slug}/checking`) ||
          (customer.first_name === `Demo-${profile.slug}` && customer.last_name === plan.seedId));
        if (owners.length > 1) throw new Error(`Multiple customers own seed ${profile.slug}; resolve before continuing.`);
        if (owners[0]) receipt.profiles.push({ slug: profile.slug, customerId: owners[0].customer._id, accounts: [], transactions: [], bills: [] });
      }
      // On the first run, preserve the first available people in returned order.
      for (const profile of plan.profiles) {
        if (receipt.profiles.some(row => row.slug === profile.slug)) continue;
        const customer = customers.find(row => !receipt.profiles.some(saved => saved.customerId === row._id));
        if (customer) receipt.profiles.push({ slug: profile.slug, customerId: customer._id, accounts: [], transactions: [], bills: [] });
      }
    }
    await save();
    for (const profile of plan.profiles) {
      let saved = receipt.profiles.find(row => row.slug === profile.slug);
      if (!saved) {
        // A stable, visibly fictional name also allows recovery after POST succeeds but the process exits.
        const firstName = `Demo-${profile.slug}`;
        let customer = customers.find(row => row.first_name === firstName && row.last_name === plan.seedId);
        if (!customer) {
          await createCustomer(firstName, plan.seedId, {
            street_number: "100", street_name: "Fictional Demo Lane", city: "Gainesville", state: "FL", zip: "32601",
          });
          customers = await getCustomers();
          customer = customers.find(row => row.first_name === firstName && row.last_name === plan.seedId);
        }
        if (!customer) throw new Error("New customer was not readable. Inspect before retrying.");
        saved = { slug: profile.slug, customerId: customer._id, accounts: [], transactions: [], bills: [] };
        receipt.profiles.push(saved);
        await save();
      }
      console.log(`Verifying ${profile.label} (${saved.customerId})`);
      let accounts = await getCustomerAccounts(saved.customerId);
      const accountPlans: { role: string; type: NessieAccountType; balanceCents: number }[] = [
        { role: "checking", type: "Checking", balanceCents: profile.checkingCents },
        { role: "savings", type: "Savings", balanceCents: profile.savingsCents },
        ...profile.ownedCardIds.map(card => ({ role: card, type: "Credit Card" as const, balanceCents: 0 })),
      ];
      for (const account of accountPlans) {
        const nickname = `${plan.seedId}/${profile.slug}/${account.role}`;
        let row = unique(accounts, "nickname", nickname);
        if (!row) {
          await createAccount(saved.customerId, account.type, nickname, units(account.balanceCents));
          accounts = await getCustomerAccounts(saved.customerId);
          row = unique(accounts, "nickname", nickname);
        }
        if (!row) throw new Error(`Account ${nickname} was not readable.`);
        verify(row, { type: account.type, customer_id: saved.customerId });
        if (typeof row.balance !== "number") throw new Error("Expected numeric account balance.");
        const snapshot = { id: row._id, role: account.role, balanceRaw: row.balance };
        saved.accounts = [...saved.accounts.filter(item => item.role !== account.role), snapshot];
        await save();
      }
      const checkingId = saved.accounts.find(account => account.role === "checking")!.id;
      for (const transaction of profile.transactions) {
        const description = `${plan.seedId}/${transaction.key} | SYNTHETIC | ${transaction.label}`;
        const list = transaction.kind === "deposit" ? getAccountDeposits : getAccountWithdrawals;
        const create = transaction.kind === "deposit" ? createDeposit : createWithdrawal;
        let row = unique(await list(checkingId), "description", description);
        if (!row) {
          await create(checkingId, units(transaction.amountCents), description, transaction.date);
          row = unique(await list(checkingId), "description", description);
        }
        if (!row) throw new Error(`Transaction ${transaction.key} was not readable. Inspect before retrying.`);
        verify(row, { amount: units(transaction.amountCents), transaction_date: transaction.date, status: "completed", medium: "balance" });
        saved.transactions = [...saved.transactions.filter(item => item.key !== transaction.key), {
          key: transaction.key, id: row._id, kind: transaction.kind, amountCents: transaction.amountCents, date: transaction.date,
        }];
        await save();
      }
      for (const bill of profile.bills) {
        const nickname = `${plan.seedId}/${profile.slug}/${bill.label}`;
        let row = unique(await getAccountBills(checkingId), "nickname", nickname);
        if (!row) {
          await createBill(checkingId, bill.payee, nickname, units(bill.amountCents), bill.paymentDate, "recurring", bill.recurringDay);
          row = unique(await getAccountBills(checkingId), "nickname", nickname);
        }
        if (!row) throw new Error(`Bill ${nickname} was not readable.`);
        verify(row, { payment_amount: units(bill.amountCents), payment_date: bill.paymentDate, status: "recurring", recurring_date: bill.recurringDay });
        saved.bills = [...saved.bills.filter(item => item.label !== bill.label), {
          id: row._id, label: bill.label, amountCents: bill.amountCents, paymentDate: bill.paymentDate,
        }];
        await save();
      }
      // Record actual post-write balances, without assuming that transactions mutate them.
      accounts = await getCustomerAccounts(saved.customerId);
      for (const account of saved.accounts) {
        const row = accounts.find(item => item._id === account.id);
        if (!row || typeof row.balance !== "number") throw new Error("Missing account balance during final verification.");
        account.balanceRaw = row.balance;
      }
      await save();
    }
    receipt.verifiedAt = new Date().toISOString();
    await save();
    console.log(JSON.stringify({ customers: receipt.profiles.length,
      accounts: receipt.profiles.reduce((sum, row) => sum + row.accounts.length, 0),
      historicalTransactions: receipt.profiles.reduce((sum, row) => sum + row.transactions.length, 0),
      recurringBills: receipt.profiles.reduce((sum, row) => sum + row.bills.length, 0),
      receipt: "data/nessie-demo/receipt.local.json",
    }, null, 2));
  } finally { await lock.close(); await unlink(lockURL); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});

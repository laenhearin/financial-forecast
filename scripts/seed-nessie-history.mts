/**
 * Writes the reviewed six-month history (data/nessie-demo/history-v2.json) to Nessie.
 *
 *   npm run nessie:seed-history              offline preview: counts only, no network
 *   npm run nessie:seed-history -- --check   read-only: finds each account and counts what is missing
 *   npm run nessie:seed-history -- --apply   creates only the missing records, then reads every one back
 *
 * Only deposits and withdrawals are created, on the seeded checking and savings accounts. Nothing is
 * edited or deleted. A record is matched by its description marker, so a rerun skips what exists.
 * Writes are never retried automatically: if one fails, the run stops, and the next run's listing
 * shows whether it landed. Only one teammate should apply.
 */
import { open, readFile, unlink, writeFile } from "node:fs/promises";
import type { NessieRecord } from "../src/lib/nessie-api";

const api: typeof import("../src/lib/nessie-api") = await import(new URL("../src/lib/nessie-api.ts", import.meta.url).href);

interface SavedRecord { seq: number; account: "checking" | "savings"; kind: "deposit" | "withdrawal"; date: string; amountCents: number; label: string; description: string }
interface SavedHistory { seedId: string; asOfDate: string; windowStart: string; profiles: { slug: string; records: SavedRecord[] }[] }

const root = new URL("../data/nessie-demo/", import.meta.url);
const history = JSON.parse(await readFile(new URL("history-v2.json", root), "utf8")) as SavedHistory;
const args = process.argv.slice(2);
const mode = args.length === 0 ? "preview" : args.length === 1 && args[0] === "--check" ? "check" : args.length === 1 && args[0] === "--apply" ? "apply" : null;
if (!mode) throw new Error("Usage: scripts/seed-nessie-history.mts [--check | --apply]");

const CONCURRENCY = 3;
const units = (cents: number) => {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents % 100 !== 0) throw new Error("History amounts must be positive whole dollars.");
  return cents / 100;
};

/** The seeded checking and savings account for each profile, found by nickname. */
async function findAccounts(): Promise<Map<string, { checking: string; savings: string }>> {
  const found = new Map<string, { checking?: string; savings?: string }>();
  for (const customer of await api.getCustomers()) {
    for (const account of await api.getCustomerAccounts(customer._id)) {
      const match = typeof account.nickname === "string" ? /^ff-demo-v1\/([a-z0-9-]+)\/(checking|savings)$/.exec(account.nickname) : null;
      if (!match) continue;
      const entry = found.get(match[1]) ?? {};
      if (entry[match[2] as "checking" | "savings"]) throw new Error(`Two ${match[2]} accounts for ${match[1]}; resolve before continuing.`);
      entry[match[2] as "checking" | "savings"] = account._id;
      found.set(match[1], entry);
    }
  }
  const accounts = new Map<string, { checking: string; savings: string }>();
  for (const { slug } of history.profiles) {
    const entry = found.get(slug);
    if (!entry?.checking || !entry.savings) throw new Error(`Missing the seeded checking or savings account for ${slug}.`);
    accounts.set(slug, { checking: entry.checking, savings: entry.savings });
  }
  return accounts;
}

const listFor = (kind: SavedRecord["kind"]) => (kind === "deposit" ? api.getAccountDeposits : api.getAccountWithdrawals);

/** Existing records by description for one account and kind; stops on duplicate markers. */
async function existing(accountId: string, kind: SavedRecord["kind"]): Promise<Map<string, NessieRecord>> {
  const byDescription = new Map<string, NessieRecord>();
  for (const row of await listFor(kind)(accountId)) {
    if (typeof row.description !== "string" || !row.description.startsWith(`${history.seedId}/`)) continue;
    if (byDescription.has(row.description)) throw new Error(`Duplicate record ${row.description}; resolve before continuing.`);
    byDescription.set(row.description, row);
  }
  return byDescription;
}

function verify(row: NessieRecord, record: SavedRecord): void {
  const expected = { amount: units(record.amountCents), transaction_date: record.date, status: "completed", medium: "balance" };
  for (const [field, value] of Object.entries(expected)) {
    if (row[field] !== value) throw new Error(`Read-back mismatch on ${record.description}: ${field}. Nothing was overwritten.`);
  }
}

async function main() {
  const total = history.profiles.reduce((sum, profile) => sum + profile.records.length, 0);
  if (mode === "preview") {
    for (const profile of history.profiles) console.log(`${profile.slug}: ${profile.records.length} records`);
    console.log(`${total} records from ${history.windowStart} to ${history.asOfDate}. No network calls. Use --check to compare with Nessie.`);
    return;
  }
  const lockURL = new URL("seed-history.local.lock", root);
  const lock = mode === "apply" ? await open(lockURL, "wx") : null;
  try {
    const accounts = await findAccounts();
    let created = 0;
    let missingTotal = 0;
    for (const profile of history.profiles) {
      const ids = accounts.get(profile.slug)!;
      const groups = [["checking", "deposit"], ["checking", "withdrawal"], ["savings", "deposit"], ["savings", "withdrawal"]] as const;
      const missing: SavedRecord[] = [];
      for (const [account, kind] of groups) {
        const records = profile.records.filter(record => record.account === account && record.kind === kind);
        if (!records.length) continue;
        const have = await existing(ids[account], kind);
        for (const record of records) {
          const row = have.get(record.description);
          if (row) verify(row, record);
          else missing.push(record);
        }
      }
      missingTotal += missing.length;
      console.log(`${profile.slug}: ${profile.records.length - missing.length} present, ${missing.length} missing`);
      if (mode !== "apply" || !missing.length) continue;

      // A few writes at a time; the first failure stops the run without retrying.
      const queue = [...missing];
      await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        for (let record = queue.shift(); record; record = queue.shift()) {
          const create = record.kind === "deposit" ? api.createDeposit : api.createWithdrawal;
          await create(ids[record.account], units(record.amountCents), record.description, record.date);
          created++;
          if (created % 50 === 0) console.log(`  ${created} created so far`);
        }
      }));
      // Read everything back once.
      for (const [account, kind] of groups) {
        const records = profile.records.filter(record => record.account === account && record.kind === kind);
        if (!records.length) continue;
        const have = await existing(ids[account], kind);
        for (const record of records) {
          const row = have.get(record.description);
          if (!row) throw new Error(`${record.description} was not readable after writing. Run --check before retrying.`);
          verify(row, record);
        }
      }
      console.log(`  ${profile.slug}: all ${profile.records.length} verified`);
    }
    if (mode === "apply") {
      await writeFile(new URL("history-v2.receipt.local.json", root), JSON.stringify({
        seedId: history.seedId, asOfDate: history.asOfDate, created, verifiedAt: new Date().toISOString(),
      }, null, 2) + "\n", { mode: 0o600 });
      console.log(`Created ${created}; every record verified.`);
    } else {
      console.log(`${missingTotal} of ${total} records missing. Nothing was written.`);
    }
  } finally {
    if (lock) { await lock.close(); await unlink(lockURL); }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "History seed failed.");
  process.exitCode = 1;
});

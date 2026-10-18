import { addDays, assertISODate, daysBetween } from "./dates";

export interface RecordedActivity {
  id: string;
  date: string;
  kind: "deposit" | "withdrawal";
  amountCents: number;
  label: string;
}

export interface HistoricalDay {
  day: number;
  balanceCents: number;
  incomeCents: number;
  spendingCents: number;
  netCents: number;
  transactions: RecordedActivity[];
}

/** Reconstruct end-of-day estimates from the snapshot, using only recorded activity.
 * Missing transactions can change these estimates; they are not bank balance snapshots.
 */
export function historicalBalances(history: readonly RecordedActivity[], asOfDate: string, snapshotCents: number): HistoricalDay[] {
  assertISODate(asOfDate);
  const safe = (value: number) => {
    if (!Number.isSafeInteger(value)) throw new Error("Historical balance exceeds the supported cents range.");
    return value;
  };
  safe(snapshotCents);
  const byDate = new Map<string, RecordedActivity[]>();
  let firstDate = asOfDate;
  for (const record of history) {
    assertISODate(record.date);
    if (record.date > asOfDate) continue;
    if (record.kind !== "deposit" && record.kind !== "withdrawal") throw new Error("Unknown recorded activity.");
    if (safe(record.amountCents) < 0) throw new Error("Recorded amounts must be nonnegative.");
    firstDate = record.date < firstDate ? record.date : firstDate;
    byDate.set(record.date, [...(byDate.get(record.date) ?? []), record]);
  }
  const result: HistoricalDay[] = [];
  let balanceCents = snapshotCents;
  const earliestDay = daysBetween(asOfDate, firstDate);
  for (let day = 0; day >= earliestDay; day--) {
    const transactions = byDate.get(addDays(asOfDate, day)) ?? [];
    const incomeCents = transactions.filter(record => record.kind === "deposit").reduce((sum, record) => safe(sum + record.amountCents), 0);
    const spendingCents = transactions.filter(record => record.kind === "withdrawal").reduce((sum, record) => safe(sum + record.amountCents), 0);
    const netCents = safe(incomeCents - spendingCents);
    if (day < 0) result.push({ day, balanceCents, incomeCents, spendingCents, netCents, transactions });
    balanceCents = safe(balanceCents - netCents);
  }
  return result.reverse();
}

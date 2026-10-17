import { assertISODate } from "./dates";

interface RecordedActivity {
  date: string;
  kind: string;
  amountCents: number;
}

/** Recorded month-to-date activity only; excludes future schedules and other months. */
export function monthlyActivity(history: readonly RecordedActivity[], asOfDate: string) {
  assertISODate(asOfDate);
  const totals = { incomeCents: 0, spendingCents: 0 };
  for (const record of history) {
    assertISODate(record.date);
    if (record.date.slice(0, 7) !== asOfDate.slice(0, 7) || record.date > asOfDate) continue;
    if (record.kind !== "deposit" && record.kind !== "withdrawal") throw new Error("Unknown recorded activity kind.");
    if (!Number.isSafeInteger(record.amountCents) || record.amountCents < 0) throw new Error("Invalid recorded amount.");
    const key = record.kind === "deposit" ? "incomeCents" : "spendingCents";
    totals[key] += record.amountCents;
    if (!Number.isSafeInteger(totals[key])) throw new Error("Monthly total exceeds the supported range.");
  }
  return totals;
}

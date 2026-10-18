import { expect, it } from "vitest";
import { classifyActivity } from "../classifyActivity";
import { aggregateTotals } from "../aggregations";
import type { AccountSnapshot } from "@/features/big-purchase/types";
import type { RecordedTransaction } from "@/lib/nessie-profile";
import { classifyTransaction } from "@/lib/spending-categories";
const accounts: AccountSnapshot[] = ["checking", "savings"].map((type) => ({
  id: type,
  nickname: type,
  type: type as "checking" | "savings",
  balanceCents: 10000,
  includeInForecast: true,
}));
const row = (
  id: string,
  kind: RecordedTransaction["kind"],
  accountId: string,
  label: string,
): RecordedTransaction => ({
  id,
  kind,
  accountId,
  label,
  amountCents: 5000,
  date: "2026-10-01",
  ...classifyTransaction(kind, label, label),
});
it("pairs both transfer legs once and keeps savings out of income/spending", () => {
  const rows = classifyActivity(
    [
      row("out", "withdrawal", "checking", "Transfer to savings"),
      row("in", "deposit", "savings", "Transfer from checking"),
      row("pay", "deposit", "checking", "Paycheck"),
      row("bill", "withdrawal", "checking", "Housing payment"),
      row(
        "invest",
        "withdrawal",
        "checking",
        "529 college savings contribution",
      ),
    ],
    accounts,
  );
  expect(rows.map((r) => r.kind)).toEqual([
    "savings",
    "internal-transfer",
    "income",
    "spending",
    "savings",
  ]);
  expect(rows[1].direction).toBe("in");
  expect(
    aggregateTotals(rows, { start: "2026-10-01", end: "2026-10-31" }),
  ).toMatchObject({
    incomeCents: 5000,
    spendingCents: 5000,
    savingsContributedCents: 10000,
    netCents: 0,
  });
});
it("never matches equal amounts with unrelated labels or double-counts a deposit", () => {
  const rows = classifyActivity(
    [
      row("a", "withdrawal", "checking", "Restaurant"),
      row("b", "deposit", "savings", "Gift"),
      row("c", "withdrawal", "savings", "Transfer to checking"),
      row("d", "deposit", "checking", "Transfer from savings"),
      row("e", "withdrawal", "savings", "Transfer to checking"),
    ],
    accounts,
  );
  expect(rows.map((r) => r.kind)).toEqual([
    "spending",
    "income",
    "internal-transfer",
    "internal-transfer",
    "spending",
  ]);
});

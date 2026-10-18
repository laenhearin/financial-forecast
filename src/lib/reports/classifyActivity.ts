import type { AccountSnapshot } from "@/features/big-purchase/types";
import { categorizeByKeyword } from "@/features/cash-back/engine/categorize";
import { CATEGORY_LABELS } from "@/features/cash-back/format";
import type { RecordedTransaction } from "../nessie-profile";
import type { ReportTransaction } from "./types";
/**
 * The normalized feed has no transfer IDs. Pair explicitly described cash-account transfers
 * only when date, amount, direction and owned account types agree. Never match by amount alone.
 * Explicit savings/investment descriptions are separately labeled estimates, not bank categories.
 */
export function classifyActivity(
  history: readonly RecordedTransaction[],
  accounts: readonly AccountSnapshot[],
): ReportTransaction[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const classified = new Map<string, ReportTransaction["kind"]>();
  for (const outgoing of history) {
    if (outgoing.kind !== "withdrawal") continue;
    const target = /^transfer to (checking|savings)(?: account)?$/i
      .exec(outgoing.label)?.[1]
      ?.toLowerCase();
    const source = accountMap.get(outgoing.accountId)?.type;
    if (!target || !source) continue;
    const incoming = history.find(
      (row) =>
        row.kind === "deposit" &&
        !classified.has(row.id) &&
        row.accountId !== outgoing.accountId &&
        accountMap.get(row.accountId)?.type === target &&
        row.date === outgoing.date &&
        row.amountCents === outgoing.amountCents &&
        new RegExp(`^transfer from ${source}(?: account)?$`, "i").test(
          row.label,
        ),
    );
    if (incoming) {
      classified.set(
        outgoing.id,
        target === "savings" && source !== "savings"
          ? "savings"
          : "internal-transfer",
      );
      classified.set(incoming.id, "internal-transfer");
    }
  }
  return history.map((row) => {
    const explicitSavings =
      row.kind === "withdrawal" &&
      /^(?:(?:529 college )?savings contribution|transfer to savings|transfer to brokerage(?: \([^)]+\))?)$/i.test(
        row.label,
      );
    const kind =
      classified.get(row.id) ??
      (explicitSavings
        ? "savings"
        : row.kind === "deposit"
          ? "income"
          : "spending");
    const categoryId = categorizeByKeyword(row.label);
    return {
      date: row.date,
      label: row.label,
      accountLabel: accountMap.get(row.accountId)?.nickname ?? "Account",
      amountCents: row.amountCents,
      kind,
      direction: row.kind === "deposit" ? "in" : "out",
      category:
        kind === "savings"
          ? "Savings / investments"
          : kind === "internal-transfer"
            ? "Own-account transfer"
            : kind === "income"
              ? "Income"
              : categoryId
                ? CATEGORY_LABELS[categoryId]
                : "Uncategorized",
    };
  });
}

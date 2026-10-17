import { describe, expect, it } from "vitest";
import plan from "../../data/nessie-demo/plan.json";
import { validateCashBackData } from "../features/cash-back/data/source";
import { bestCardForPurchase, CapLedger, scoreCard } from "../features/cash-back/engine/rewards";
import { cardsByIds, findCard } from "../features/cash-back/cards/library";

describe("five-person Nessie seed", () => {
  it("contains 20 unique, dated transactions across five profiles, all within the 90-day window", () => {
    expect(plan.profiles).toHaveLength(5);
    expect((Date.parse(plan.asOfDate) - Date.parse(plan.windowStart)) / 86400000).toBe(89);
    const transactions = plan.profiles.flatMap(profile => profile.transactions);
    expect(transactions).toHaveLength(20);
    expect(new Set(transactions.map(tx => tx.key)).size).toBe(20);
    for (const transaction of transactions) {
      expect(transaction.date >= plan.windowStart && transaction.date <= plan.asOfDate).toBe(true);
      expect(Number.isSafeInteger(transaction.amountCents) && transaction.amountCents > 0).toBe(true);
      expect(transaction.amountCents % 100).toBe(0);
    }
  });
  it("has usable card mappings, future bills, and separate hypothetical goals", () => {
    for (const profile of plan.profiles) {
      const purchases = profile.transactions.filter(tx => tx.kind === "withdrawal").map(tx => ({
        id: tx.key, date: tx.date, merchant: tx.label, amountCents: tx.amountCents, cardId: tx.cardId!,
      }));
      expect(validateCashBackData({ customerName: profile.label, asOfDate: plan.asOfDate,
        ownedCardIds: profile.ownedCardIds, purchases })).toEqual([]);
      expect(profile.goal.preferredDeadline > plan.asOfDate).toBe(true);
      for (const bill of profile.bills) expect(bill.paymentDate > plan.asOfDate).toBe(true);
    }
  });
  it("gives the student a concrete $1.84 grocery reward improvement under the sample rules", () => {
    const profile = plan.profiles[0];
    const transaction = profile.transactions[1];
    const query = { category: "groceries" as const, amountCents: transaction.amountCents, date: transaction.date };
    const ledger = new CapLedger();
    const best = bestCardForPurchase(query, cardsByIds(profile.ownedCardIds), ledger)[0];
    const used = scoreCard(findCard("everyday-1")!, query.category, query.amountCents, query.date, ledger);
    expect(best.cardId).toBe("market-fresh");
    expect(best.rewardCents).toBe(276);
    expect(used.rewardCents).toBe(92);
    expect(best.rewardCents - used.rewardCents).toBe(184);
  });
});

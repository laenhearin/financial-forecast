import { describe, expect, it } from "vitest";
import plan from "../../data/nessie-demo/plan.json";
import { validateCashBackData } from "../features/cash-back/data/source";
import { getEffectiveRate, rankCards } from "../features/cash-back/engine/rewards";
import { cardsByIds, findCard, resolveCardId } from "../features/cash-back/cards/catalog";

describe("eight-person Nessie seed", () => {
  it("contains 32 unique, dated transactions across eight profiles, all within the 90-day window", () => {
    expect(plan.profiles).toHaveLength(8);
    expect((Date.parse(plan.asOfDate) - Date.parse(plan.windowStart)) / 86400000).toBe(89);
    const transactions = plan.profiles.flatMap(profile => profile.transactions);
    expect(transactions).toHaveLength(32);
    expect(new Set(transactions.map(tx => tx.key)).size).toBe(32);
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
      expect(Object.values(profile.monthlySpendingByCategory).reduce((sum, cents) => sum + (cents ?? 0), 0)).toBe(profile.estimatedMonthlySpendingCents);
      for (const bill of profile.bills) expect(bill.paymentDate > plan.asOfDate).toBe(true);
    }
  });
  it("gives the student a concrete $1.38 grocery reward improvement under the catalog rules", () => {
    // The seed keeps its old sample-card ids; each maps to a real catalog card.
    const profile = plan.profiles[0];
    const transaction = profile.transactions[1];
    const owned = cardsByIds(profile.ownedCardIds.map(id => resolveCardId(id)!));
    const ctx = { today: transaction.date };
    const best = rankCards(owned, "groceries", ctx)[0];
    const used = getEffectiveRate(findCard(resolveCardId(transaction.cardId!)!)!, "groceries", ctx);
    const reward = (rateBps: number) => Math.round((transaction.amountCents * rateBps) / 10_000);
    expect(best.cardId).toBe("amex-blue-cash-everyday");
    expect(reward(best.rateBps)).toBe(276);
    expect(reward(used.rateBps)).toBe(138);
    expect(reward(best.rateBps) - reward(used.rateBps)).toBe(138);
  });
});

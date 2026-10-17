import { describe, expect, it } from "vitest";
import { makeScenario, monthlyBill, paycheck } from "@/features/big-purchase/engine/testScenario";
import { checkPurchase, earliestSaferDate, purchaseRecommendation, worsenedDays } from "./purchaseCheck";

// $3,000 on Jan 1, $1,200 rent on the 5th, $1,500 paycheck every other Friday from Jan 9.
const scenario = makeScenario({
  balanceCents: 300_000,
  income: [paycheck(150_000, "2026-01-09")],
  bills: [monthlyBill("rent", 120_000, 5, { label: "Rent", category: "housing" })],
});
const purchase = (amountCents: number, date = "2026-01-02") => ({ label: "Laptop", amountCents, date, accountId: "checking" });
const CRITICAL = 120_000;

describe("checkPurchase", () => {
  it("rates the lowest balance after the purchase date", () => {
    const check = checkPurchase(scenario, [], purchase(50_000), CRITICAL);
    expect(check.lowestWithout).toEqual({ date: "2026-01-05", cents: 180_000 });
    expect(check.lowestWith).toEqual({ date: "2026-01-05", cents: 130_000 });
    expect(check.level).toBe(3);
    expect(purchaseRecommendation(check).title).toBe("This looks risky");
  });

  it("covers every level's recommendation", () => {
    expect(purchaseRecommendation(checkPurchase(scenario, [], purchase(1_000), CRITICAL)).title).toBe("Possible, with a tighter buffer");
    expect(purchaseRecommendation(checkPurchase(scenario, [], purchase(70_000), CRITICAL)).title).toBe("I’d wait or lower the cost");
    const overdrawn = checkPurchase(scenario, [], purchase(200_000), CRITICAL);
    expect(overdrawn.level).toBe(5);
    expect(purchaseRecommendation(overdrawn).detail).toMatch(/^The forecast falls below \$0, reaching -\$200 on Jan 5\./);
    expect(checkPurchase(scenario, [], purchase(1_000), 0).level).toBe(0);
  });

  it("lists the days whose level gets worse", () => {
    const days = worsenedDays(checkPurchase(scenario, [], purchase(50_000), CRITICAL));
    // $2,500 on Jan 2-4 is still THRIVING; rent day through the paycheck drops from CAUTION to NEAR CRITICAL.
    expect(days).toEqual(["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"].map((date) => ({ date, from: 2, to: 3 })));
  });

  it("finds the first later date that keeps the verdict at caution or better", () => {
    expect(earliestSaferDate(scenario, [], purchase(50_000), CRITICAL)).toBe("2026-01-09");
    expect(earliestSaferDate(scenario, [], purchase(5_000_000), CRITICAL)).toBeNull();
  });
});

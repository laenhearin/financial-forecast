import { describe, expect, it } from "vitest";
import { makeScenario, monthlyBill, paycheck } from "@/features/big-purchase/engine/testScenario";
import { buildAdvisorFacts } from "@/lib/ai/facts/advisor";
import { advisorTemplate } from "@/lib/ai/fallbacks";
import { checkPurchase, earliestSaferDate, needsTransfer, purchaseRecommendation, worsenedDays } from "./purchaseCheck";

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

describe("review scenarios for the Purchase Advisor", () => {
  // $100 checking and $5,000 savings: plenty overall, but not in the paying account (review test 13).
  const savingsRich = makeScenario({
    accounts: [
      { id: "checking", nickname: "Checking", type: "checking", balanceCents: 10_000, includeInForecast: true },
      { id: "savings", nickname: "Savings", type: "savings", balanceCents: 500_000, includeInForecast: true },
    ],
  });

  it("separates overall affordability from whether the paying account can cover it", () => {
    const fromChecking = checkPurchase(savingsRich, [], { label: "TV", amountCents: 100_000, date: "2026-01-02", accountId: "checking" }, 0);
    expect(fromChecking.lowestWith.cents).toBe(410_000);
    expect(fromChecking.payingAccount).toEqual({ id: "checking", lowest: { date: "2026-01-02", cents: -90_000 } });
    expect(needsTransfer(fromChecking)).toBe(true);
    const fromSavings = checkPurchase(savingsRich, [], { label: "TV", amountCents: 100_000, date: "2026-01-02", accountId: "savings" }, 0);
    expect(needsTransfer(fromSavings)).toBe(false);
    // The template and the AI facts say the same thing.
    const facts = buildAdvisorFacts(savingsRich, [], { label: "TV", amountCents: 100_000, date: "2026-01-02", accountId: "checking" }, 0);
    expect(facts.payingAccount).toEqual({ name: "Checking", lowest: { date: "2026-01-02", cents: -90_000 }, needsTransfer: true });
    expect(advisorTemplate(facts).explanation).toContain("Checking alone would drop to -$900 on Jan 2, so move money into it first");
  });

  it("does not flag a transfer when the total is short too; the verdict already says below $0", () => {
    const check = checkPurchase(savingsRich, [], { label: "Car", amountCents: 600_000, date: "2026-01-02", accountId: "checking" }, 0);
    expect(check.level).toBe(5);
    expect(needsTransfer(check)).toBe(false);
  });

  it("rates a purchase after payday better than the day before (review tests 14 and 15)", () => {
    const before = checkPurchase(scenario, [], purchase(50_000, "2026-01-08"), CRITICAL);
    const after = checkPurchase(scenario, [], purchase(50_000, "2026-01-09"), CRITICAL);
    expect(after.level).toBeLessThan(before.level);
  });

  it("counts a bill and a purchase on the same day in that day's end-of-day balance (review test 16)", () => {
    const check = checkPurchase(scenario, [], purchase(30_000, "2026-01-05"), CRITICAL);
    // $3,000 - $1,200 rent - $300 purchase, at the end of Jan 5.
    expect(check.lowestWith).toEqual({ date: "2026-01-05", cents: 150_000 });
  });

  it("includes purchases the user already added, recurring ones too, in the baseline (review test 18)", () => {
    const gym = { id: "gym", label: "Gym", amountCents: 10_000, date: "2026-01-03", accountId: "checking", recurring: true };
    const without = checkPurchase(scenario, [], purchase(1_000), CRITICAL);
    const withGym = checkPurchase(scenario, [gym], purchase(1_000), CRITICAL);
    expect(withGym.lowestWithout.cents).toBe(without.lowestWithout.cents - 10_000);
  });
});

import { describe, expect, it } from "vitest";
import { makeScenario, monthlyBill, paycheck } from "@/features/big-purchase/engine/testScenario";
import { auditNumbers } from "./audit";
import { buildAdvisorFacts } from "./facts/advisor";
import { buildBaseline } from "./facts/baseline";
import { buildGoalSummaryFacts } from "./facts/goalSummary";
import { advisorTemplate, askTemplate, goalSummaryTemplate } from "./fallbacks";
import { toPromptFacts } from "./promptJson";
import { parseAdvisorExplanation, parseGoalSummary } from "./schemas";

const scenario = makeScenario({
  balanceCents: 300_000,
  income: [paycheck(150_000, "2026-01-09")],
  bills: [monthlyBill("rent", 120_000, 5, { label: "Rent", category: "housing" })],
});
const purchase = (amountCents: number) => ({ label: "Headphones", amountCents, date: "2026-01-02", accountId: "checking" });

describe("advisorTemplate", () => {
  it("explains a risky purchase with the safer date, using only fact figures", () => {
    const facts = buildAdvisorFacts(scenario, [], purchase(50_000), 120_000);
    const text = advisorTemplate(facts);
    expect(text.headline).toBe("This looks risky");
    expect(text.explanation).toBe("Buying Headphones ($500) on Jan 2 takes your lowest balance to $1,300 on Jan 5, which is near critical for your $1,200 critical balance. 4 days get a worse balance level.");
    expect(text.alternative).toBe("Waiting until Jan 9 would keep your forecast at caution or better.");
    expect(parseAdvisorExplanation(text)).toEqual(text);
    expect(auditNumbers(Object.values(text).join(" "), [toPromptFacts(facts)]).ok).toBe(true);
  });

  it("reassures for a comfortable purchase and gives no alternative", () => {
    const text = advisorTemplate(buildAdvisorFacts(scenario, [], purchase(1_000), 0));
    expect(text.headline).toBe("Looks manageable in this forecast");
    expect(text.explanation).toMatch(/^Buying Headphones \(\$10\) on Jan 2 keeps your forecast thriving\./);
    expect(text.alternative).toBeNull();
  });
});

describe("goalSummaryTemplate", () => {
  it("states the plan from engine facts and passes the audit", () => {
    const facts = buildGoalSummaryFacts(scenario, { goal: { name: "Laptop", costCents: 180_000, bufferCents: 27_000, contributionCents: 30_000, deadline: null } })!;
    const text = goalSummaryTemplate(facts);
    expect(text).toMatch(/^At \$300 per paycheck you can afford your laptop on [A-Z][a-z]+ \d+\./);
    expect(parseGoalSummary({ summary: text })).toBe(text);
    expect(auditNumbers(text, [toPromptFacts(facts)]).ok).toBe(true);
  });

  it("returns null facts when the goal has no forecast", () => {
    expect(buildGoalSummaryFacts(makeScenario(), { goal: { name: "Laptop", costCents: 180_000, bufferCents: 0, contributionCents: null, deadline: null } })).toBeNull();
  });
});

describe("askTemplate", () => {
  const baseline = buildBaseline(scenario, [], 120_000);

  it("summarizes the next two weeks", () => {
    expect(askTemplate(baseline, "What does my week look like?")).toBe(
      "Your balance is $3,000 today. The lowest point in the next 14 days is $1,800 on Jan 5 (caution). 4 days are at caution or worse, measured against your $1,200 critical balance. Next bill: Rent, $1,200 on Jan 5.",
    );
  });

  it("points to the Purchase Advisor when the question has an amount", () => {
    expect(askTemplate(baseline, "Can I afford $400 headphones?")).toMatch(/try the Purchase Advisor\.$/);
  });

  it("only uses figures from the baseline", () => {
    expect(auditNumbers(askTemplate(baseline, "$5?"), [toPromptFacts(baseline)]).ok).toBe(true);
  });
});

describe("output validators", () => {
  it("strips markdown, enforces lengths and accepts a null alternative", () => {
    expect(parseAdvisorExplanation({ headline: "**Looks fine**", explanation: "All good.", alternative: null }))
      .toEqual({ headline: "Looks fine", explanation: "All good.", alternative: null });
    expect(parseAdvisorExplanation({ headline: "x".repeat(81), explanation: "ok", alternative: null })).toBeNull();
    expect(parseAdvisorExplanation({ headline: "ok", explanation: "", alternative: null })).toBeNull();
    expect(parseAdvisorExplanation({ headline: "ok", explanation: "ok", alternative: 5 })).toBeNull();
    expect(parseGoalSummary({ summary: 3 })).toBeNull();
  });
});

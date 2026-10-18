import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import plan from "../../../data/nessie-demo/plan.json";
import saved from "../../../data/nessie-demo/history-v2.json";
import { computeForecast } from "../../features/big-purchase/engine/forecast";
import { buildCustomerProfile } from "../nessie-profile";
import { planAssumptionsFor } from "../plan-assumptions";
import { classifyTransaction, parseSeedTag } from "../spending-categories";
import { generatePersonaHistory, historyWindowStart, HISTORY_MONTHS, type PlanProfileInput } from "./generate";
import { PERSONAS } from "./personas";

const profiles = plan.profiles as unknown as (PlanProfileInput & { goal: { costCents: number; bufferCents: number } })[];
const results = PERSONAS.map(persona => ({ persona, plan: profiles.find(row => row.slug === persona.slug)!, ...generatePersonaHistory(profiles.find(row => row.slug === persona.slug)!, persona, plan.asOfDate) }));
const start = historyWindowStart(plan.asOfDate);

describe("six-month Nessie demo history", () => {
  it("covers every seeded profile and matches the reviewed history-v2.json", () => {
    expect(start).toBe("2026-04-18");
    expect(results.map(result => result.slug)).toEqual(profiles.map(profile => profile.slug));
    expect(saved.windowStart).toBe(start);
    expect(saved.profiles.map(({ slug, startCheckingCents, startSavingsCents, lowestCheckingCents, records }) =>
      ({ slug, startCheckingCents, startSavingsCents, lowestCheckingCents, records }))).toEqual(results.map(({ slug, startCheckingCents, startSavingsCents, lowestCheckingCents, records }) =>
      ({ slug, startCheckingCents, startSavingsCents, lowestCheckingCents, records })));
  });

  it("writes valid, whole-dollar, uniquely tagged records inside the window", () => {
    const descriptions = new Set<string>();
    for (const { records } of results) {
      for (const record of records) {
        expect(record.date >= start && record.date <= plan.asOfDate).toBe(true);
        expect(record.amountCents > 0 && record.amountCents % 100 === 0).toBe(true);
        expect(parseSeedTag(record.description)).not.toBeNull();
        descriptions.add(record.description);
      }
    }
    expect(descriptions.size).toBe(results.reduce((sum, result) => sum + result.records.length, 0));
  });

  it("keeps each profile at 15 to 30 transactions a month", () => {
    for (const { slug, records } of results) {
      const perMonth = records.length / HISTORY_MONTHS;
      expect(perMonth, slug).toBeGreaterThanOrEqual(15);
      expect(perMonth, slug).toBeLessThanOrEqual(31);
    }
  });

  it("averages each spending category to the persona budget, which adds up to the plan's monthly spending", () => {
    for (const { persona, plan: profile, records } of results) {
      const totals = new Map<string, number>();
      const count = (category: string | null, cents: number) => category && totals.set(category, (totals.get(category) ?? 0) + cents);
      for (const row of profile.transactions) {
        const { flow, category } = classifyTransaction(row.kind, "", row.label);
        if (flow === "spend" && row.date >= start) count(category, row.amountCents);
      }
      for (const row of records) {
        const parsed = parseSeedTag(row.description)!;
        if (parsed.flow === "spend") count(parsed.category, row.amountCents);
      }
      expect(Object.fromEntries([...totals].map(([category, cents]) => [category, cents / HISTORY_MONTHS])), persona.slug)
        .toEqual(Object.fromEntries(persona.spend.map(rule => [rule.category, rule.monthlyCents])));
      expect(persona.spend.reduce((sum, rule) => sum + rule.monthlyCents, 0)).toBe(profile.estimatedMonthlySpendingCents);
    }
  });

  it("never takes a reconstructed balance below zero, and starts near today's balances", () => {
    for (const { persona, plan: profile, startCheckingCents, startSavingsCents, lowestCheckingCents } of results) {
      expect(lowestCheckingCents, persona.slug).toBeGreaterThanOrEqual(0);
      expect(startSavingsCents, persona.slug).toBeGreaterThanOrEqual(0);
      expect(startCheckingCents, persona.slug).toBe(persona.startCheckingCents ?? profile.checkingCents);
    }
  });

  it("leaves every forecast as it was with the old single spending line", () => {
    for (const { persona, plan: profile, records } of results) {
      const raw = nessieRecords(profile, records);
      const { scenario } = buildCustomerProfile({ ...raw, assumptions: planAssumptionsFor(raw.accounts) }, plan.asOfDate);
      expect(scenario.spending.reduce((sum, category) => sum + category.monthlyAmountCents, 0), persona.slug).toBe(profile.estimatedMonthlySpendingCents);
      const before = { ...scenario, spending: [{ id: "plan-spending", label: "Everyday spending", monthlyAmountCents: profile.estimatedMonthlySpendingCents, cuttable: true, maxCutPercent: 25 }] };
      const goal = { costCents: profile.goal.costCents, bufferCents: profile.goal.bufferCents, contributionCents: null };
      const [old, now] = [computeForecast(before, goal), computeForecast(scenario, goal)];
      if (!old.ok || !now.ok) throw new Error(`${persona.slug}: forecast failed`);
      expect(now.forecast.plan.affordableDate, persona.slug).toBe(old.forecast.plan.affordableDate);
      expect(now.forecast.suggestedContributionCents, persona.slug).toBe(old.forecast.suggestedContributionCents);
    }
  });
});

/** The records as Nessie would return them for this profile (v1 and v2 history, accounts, bills). */
function nessieRecords(profile: PlanProfileInput & { slug: string }, records: { account: string; kind: string; date: string; amountCents: number; description: string }[]) {
  const checking = `${profile.slug}-checking`;
  const savings = `${profile.slug}-savings`;
  const row = (id: string, date: string, cents: number, description: string) =>
    ({ _id: id, medium: "balance", status: "completed", transaction_date: date, amount: cents / 100, description });
  const v1 = profile.transactions.map(tx => ({ ...tx, account: "checking", description: `ff-demo-v1/${tx.key} | SYNTHETIC | ${tx.label}` }));
  const all = [...v1, ...records].map((tx, index) => ({ ...tx, record: row(`${profile.slug}-${index}`, tx.date, tx.amountCents, tx.description) }));
  const activity = (account: string, id: string) => ({
    accountId: id,
    deposits: all.filter(tx => tx.account === account && tx.kind === "deposit").map(tx => tx.record) as never,
    withdrawals: all.filter(tx => tx.account === account && tx.kind === "withdrawal").map(tx => tx.record) as never,
    bills: (account === "checking" ? profile.bills.map((bill, index) => ({
      _id: `${profile.slug}-bill-${index}`, status: "recurring", payee: bill.payee, nickname: `ff-demo-v1/${profile.slug}/${bill.label}`,
      payment_date: "2026-11-01", recurring_date: bill.recurringDay, payment_amount: bill.amountCents / 100,
    })) : []) as never,
  });
  return {
    customer: { id: profile.slug, name: profile.slug },
    accounts: [
      { _id: checking, type: "Checking", nickname: `ff-demo-v1/${profile.slug}/checking`, balance: profile.checkingCents / 100 },
      { _id: savings, type: "Savings", nickname: `ff-demo-v1/${profile.slug}/savings`, balance: profile.savingsCents / 100 },
    ],
    activity: [activity("checking", checking), activity("savings", savings)],
  };
}

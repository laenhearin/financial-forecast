/** Read-only rehearsal: uses the same live Nessie profiles and deterministic engines as the UI. */
const { listNessieCustomers, loadCustomerProfile }: typeof import("../src/lib/nessie-profile") =
  await import(new URL("../src/lib/nessie-profile.ts", import.meta.url).href);
const { addDays, calendarDateInTimeZone }: typeof import("../src/lib/dates") =
  await import(new URL("../src/lib/dates.ts", import.meta.url).href);
const { buildAdvisorFacts }: typeof import("../src/lib/ai/facts/advisor") =
  await import(new URL("../src/lib/ai/facts/advisor.ts", import.meta.url).href);
const { defaultCriticalBalanceCents }: typeof import("../src/features/calendar/engine/balanceThresholds") =
  await import(new URL("../src/features/calendar/engine/balanceThresholds.ts", import.meta.url).href);
const { computeForecast }: typeof import("../src/features/big-purchase/engine/forecast") =
  await import(new URL("../src/features/big-purchase/engine/forecast.ts", import.meta.url).href);
const { defaultBufferCents }: typeof import("../src/features/big-purchase/state/goalStore") =
  await import(new URL("../src/features/big-purchase/state/goalStore.ts", import.meta.url).href);

try {
  const today = calendarDateInTimeZone(new Date());
  const customers = await listNessieCustomers();
  const results = [];
  for (const customer of customers) {
    const { scenario, history } = await loadCustomerProfile(customer, today);
    const accountId = scenario.accounts[0]?.id;
    if (!accountId) throw new Error("A demo customer has no cash account.");
    const critical = defaultCriticalBalanceCents(scenario);
    const purchase = { label: "Demo laptop", amountCents: 50_000, date: addDays(today, 1), accountId };
    const advisor = buildAdvisorFacts(scenario, [], purchase, critical);
    const delayed = advisor.earliestSaferDate
      ? buildAdvisorFacts(scenario, [], { ...purchase, date: advisor.earliestSaferDate }, critical) : null;
    const goal = computeForecast(scenario, { costCents: 120_000, bufferCents: defaultBufferCents(120_000), contributionCents: 5_000 });
    results.push({
      customer: customer.name,
      asOfDate: today,
      accounts: scenario.accounts.map(({ nickname, type, balanceCents }) => ({ nickname, type, balanceCents })),
      recordedTransactions: history.length,
      criticalCents: critical,
      income: scenario.income,
      bills: scenario.bills.map(({ label, amountCents, schedule }) => ({ label, amountCents, schedule })),
      spendingCoverage: scenario.spendingCoverage,
      monthlySpendingCents: scenario.spending.reduce((sum, row) => sum + row.monthlyAmountCents, 0),
      purchase: advisor,
      delayedPurchase: delayed,
      savingsGoal: goal.ok ? {
        suggestedContributionCents: goal.forecast.suggestedContributionCents,
        affordableDate: goal.forecast.plan.affordableDate,
        affordableNow: goal.forecast.plan.affordableNow,
        contributionCents: goal.forecast.plan.contributionCents,
        paycheckCount: goal.forecast.plan.paycheckCount,
        tier: goal.forecast.plan.tier,
        lowestSpendableCents: goal.forecast.plan.lowestSpendableCents,
        firstViolation: goal.forecast.plan.violations[0] ?? null,
      } : goal,
    });
  }
  console.log(JSON.stringify({ source: "Live Nessie sandbox reads; synthetic customers; no writes", results }, null, 2));
} catch {
  console.error("Demo verification failed. Check the Nessie configuration and run npm run nessie:read for a sanitized diagnostic.");
  process.exitCode = 1;
}

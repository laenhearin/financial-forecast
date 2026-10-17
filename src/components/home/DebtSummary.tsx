import type { Scenario } from "@/features/big-purchase/types";
import { formatUSD } from "@/lib/money";

/** Liabilities stay separate from the cash available to the forecast. */
export function DebtSummary({ scenario }: { scenario: Scenario }) {
  if (!scenario.debts?.length) return null;
  const debt = scenario.debts.reduce((total, item) => total + item.balanceCents, 0);
  const payment = scenario.debts.reduce((total, item) => total + item.monthlyPaymentCents, 0);
  const cash = scenario.accounts.filter(account => account.includeInForecast).reduce((total, account) => total + account.balanceCents, 0);
  return (
    <section aria-label="Existing debt" className="mb-4 rounded-panel border border-app bg-card p-4 text-caption text-secondary">
      <h2 className="font-semibold text-primary">Existing debt: {formatUSD(debt)}</h2>
      <p className="mt-1">Cash available: {formatUSD(cash)} · Cash minus debt: <span className={cash < debt ? "text-neg" : "text-primary"}>{formatUSD(cash - debt)}</span></p>
      <p className="mt-1">Scheduled loan payments: {formatUSD(payment)}/month, included in the calendar. Debt is a snapshot as of {scenario.asOfDate}; future interest is not modeled.</p>
    </section>
  );
}

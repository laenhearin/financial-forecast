import type { DataSource } from "./dataSource";

/**
 * Stub for live data. Not wired up.
 *
 * This file runs in the browser, so it must never call Nessie or hold an API key. A real version
 * should fetch a server route (owned by the Nessie teammate, see src/lib/nessie.ts) that returns
 * an already-normalized Scenario in cents.
 *
 * Likely field sources, all UNCONFIRMED until checked against https://prod.nessieisreal.com/docs:
 * - accounts: the customer's accounts (balance, type, nickname)
 * - income: deposits, with recurring paychecks inferred or confirmed by the user
 * - bills: the account's bills (payee, amount, due date, recurrence)
 * - spending: purchases grouped by category into monthly estimates
 * - oneOffs: scheduled one-time bills or deposits
 */
export const nessieDataSource: DataSource = {
  sourceLabel: "Nessie (not connected)",
  isFixture: false,
  async getScenario() {
    throw new Error("The Nessie data source is not implemented yet. Use the demo data source.");
  },
};

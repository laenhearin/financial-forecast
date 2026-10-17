import "server-only";
import { loadActiveDemo } from "@/lib/active-demo";
import { defaultCriticalBalanceCents } from "@/features/calendar/engine/balanceThresholds";
import { scenarioEntries } from "@/features/calendar/engine/entries";
import type { Scenario } from "@/features/big-purchase/types";
import type { CalendarEntry, UserPurchase } from "@/features/calendar/types";
import type { Cents, SavedPurchaseInput } from "../types";

/**
 * The financial data the AI routes compute facts from: the same server-side demo profile the pages
 * load, plus the purchases and critical balance the browser keeps in localStorage (sent with each
 * request and validated). Read-only; nothing here writes to Nessie or to storage.
 */
export interface FinanceContext {
  scenario: Scenario;
  entries: CalendarEntry[];
  purchases: UserPurchase[];
  criticalCents: Cents;
  /** The demo's fixed "today": the scenario's as-of date, matching every page. */
  today: string;
}

export async function loadFinanceContext(purchases: readonly SavedPurchaseInput[], criticalBalanceCents: Cents | null): Promise<FinanceContext> {
  const { scenario } = await loadActiveDemo();
  return financeContext(scenario, purchases, criticalBalanceCents);
}

export function financeContext(scenario: Scenario, purchases: readonly SavedPurchaseInput[], criticalBalanceCents: Cents | null): FinanceContext {
  const accounts = new Set(scenario.accounts.map((account) => account.id));
  return {
    scenario,
    entries: scenarioEntries(scenario),
    // Purchases for another profile's accounts are ignored, as the calendar does.
    purchases: purchases.filter((purchase) => accounts.has(purchase.accountId)),
    criticalCents: criticalBalanceCents ?? defaultCriticalBalanceCents(scenario),
    today: scenario.asOfDate,
  };
}

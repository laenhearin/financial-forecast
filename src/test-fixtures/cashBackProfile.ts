// TEST FIXTURES ONLY. The app builds Cash Back from Nessie (src/lib/nessie-profile.ts); lint blocks app imports.
// A rich, fixed monthly spending profile so the reward engine tests cover every category.
// Run npm test after editing: cashBackProfile.test.ts checks the expected results still hold.
import type { CashBackProfile } from "../features/cash-back/data/source";
import { dollarsToCents } from "../lib/money";
import type { CategoryId, ISODate, SpendProfile } from "../features/cash-back/types";

export const DEMO_CUSTOMER = "Fixture Customer";

/** The fixture's "today". Every calculation takes it as an input, so the Q4 2026 categories stay active. */
export const DEMO_AS_OF_DATE: ISODate = "2026-10-17";

/** Three Capital One family cards plus Amex Blue Cash Everyday, all with no annual fee. */
export const DEMO_OWNED_CARD_IDS: readonly string[] = [
  "capital-one-savor",
  "capital-one-quicksilver",
  "discover-it-cash-back",
  "amex-blue-cash-everyday",
];

const MONTHLY_DOLLARS: Partial<Record<CategoryId, number>> = {
  groceries: 450,
  dining: 350,
  other: 300,
  utilities: 220,
  gas: 160,
  online_shopping: 120,
  entertainment: 80,
  amazon: 60,
  streaming: 45,
  transit: 40,
  drugstores: 30,
};

export const DEMO_SPEND_PROFILE: SpendProfile = Object.fromEntries(
  Object.entries(MONTHLY_DOLLARS).map(([category, dollars]) => [category, dollarsToCents(dollars ?? 0)]),
);

export function loadTestCashBackProfile(): CashBackProfile {
  return {
    customerName: DEMO_CUSTOMER,
    asOfDate: DEMO_AS_OF_DATE,
    ownedCardIds: DEMO_OWNED_CARD_IDS,
    spendProfile: DEMO_SPEND_PROFILE,
    sourceLabel: "Test fixture",
  };
}

// EDIT HERE. Demo customer for Cash Back. Fixture data, not a real customer or live bank data.
// Alex Rivera matches the Big Purchase demo customer. Nessie has no purchase-list endpoint, so the
// page uses this fixed monthly spending profile, which keeps the numbers stable on stage.
// The owned cards are the starting value of the saved card list; a saved list wins once it exists.
// Run npm test after editing: the demo-lock test checks the story still holds.
import { dollarsToCents } from "../../../lib/money";
import type { CategoryId, ISODate, SpendProfile } from "../types";

export const DEMO_CUSTOMER = "Alex Rivera";

/** The demo's "today". Every calculation takes it as an input, so the Q4 2026 categories stay active. */
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

import { isISODate } from "../../../lib/dates";
import { isCents } from "../../../lib/money";
import { resolveCardId } from "../cards/catalog";
import type { ISODate, Purchase, SpendProfile } from "../types";
import { DEMO_AS_OF_DATE, DEMO_CUSTOMER, DEMO_OWNED_CARD_IDS, DEMO_SPEND_PROFILE } from "./demoProfile";

/** What the Cash Back page runs on. */
export interface CashBackProfile {
  customerName: string;
  /** The data's "today", YYYY-MM-DD. Every calculation takes it as an input. */
  asOfDate: ISODate;
  /** Starting owned cards, until the user saves their own list. */
  ownedCardIds: readonly string[];
  /** Monthly spend per category. */
  spendProfile: SpendProfile;
  /** Shown in the UI so fixture data is always labelled. */
  sourceLabel: string;
  isFixture: boolean;
}

/** The demo customer with fixed monthly spending, so the numbers are stable on stage. */
export function loadDemoProfile(): CashBackProfile {
  return {
    customerName: DEMO_CUSTOMER,
    asOfDate: DEMO_AS_OF_DATE,
    ownedCardIds: DEMO_OWNED_CARD_IDS,
    spendProfile: DEMO_SPEND_PROFILE,
    sourceLabel: "Demo data",
    isFixture: true,
  };
}

/**
 * Purchase history in cents, as produced by the seeded Nessie adapter (src/lib/nessie-demo.ts).
 * The page doesn't read it yet: the current Nessie API (checked 2026-10-17 against
 * https://prod.nessieisreal.com/nessie-openapi-spec.yaml) has no endpoint that lists an account's
 * purchases, and the seed has only a few withdrawals per profile, too sparse for a spending profile.
 */
export interface CashBackData {
  customerName: string;
  /** The data's "today", YYYY-MM-DD. */
  asOfDate: ISODate;
  /** Cards the customer owns. Old sample-card ids from the seed are accepted. */
  ownedCardIds: string[];
  purchases: Purchase[];
}

/** Returns one message per problem; an empty list means the data is usable. */
export function validateCashBackData(data: CashBackData): string[] {
  const problems: string[] = [];
  if (!isISODate(data.asOfDate)) problems.push(`As-of date "${data.asOfDate}" is not a YYYY-MM-DD date.`);
  for (const id of data.ownedCardIds) if (!resolveCardId(id)) problems.push(`Owned card "${id}" is not in the card catalog.`);
  const ids = new Set<string>();
  for (const purchase of data.purchases) {
    const label = `Purchase ${purchase.id} (${purchase.merchant})`;
    if (ids.has(purchase.id)) problems.push(`${label} has a duplicate id.`);
    ids.add(purchase.id);
    if (!isISODate(purchase.date)) problems.push(`${label} has an invalid date "${purchase.date}".`);
    else if (isISODate(data.asOfDate) && purchase.date > data.asOfDate) problems.push(`${label} is dated after the as-of date.`);
    if (!isCents(purchase.amountCents) || purchase.amountCents <= 0) problems.push(`${label} needs a positive amount.`);
    if (!purchase.merchant.trim()) problems.push(`${label} has no merchant name.`);
    if (!resolveCardId(purchase.cardId)) problems.push(`${label} uses card "${purchase.cardId}", which is not in the card catalog.`);
    else if (!data.ownedCardIds.includes(purchase.cardId)) problems.push(`${label} uses card "${purchase.cardId}", which the customer does not own.`);
  }
  return problems;
}

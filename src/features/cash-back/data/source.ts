import { isISODate } from "../../../lib/dates";
import { isCents } from "../../../lib/money";
import { resolveCardId } from "../cards/catalog";
import type { ISODate, Purchase, SpendProfile } from "../types";

/**
 * What the Cash Back page runs on, built on the server from the active Nessie customer
 * (src/lib/nessie-profile.ts): owned cards from their credit card accounts, and monthly spend per
 * category estimated from their recent withdrawals.
 */
export interface CashBackProfile {
  customerName: string;
  /** The data's "today", YYYY-MM-DD. Every calculation takes it as an input. */
  asOfDate: ISODate;
  /** Cards from the customer's Nessie credit card accounts, until the user saves their own list. */
  ownedCardIds: readonly string[];
  /** Monthly spend per category. */
  spendProfile: SpendProfile;
  /** Shown in the UI so the data source is always labelled. */
  sourceLabel: string;
}

/**
 * Card-level purchase history in cents. Used to check the seed plan's card assignments
 * (data/nessie-demo/plan.json). The app does not read it: Nessie withdrawals carry no card, and the
 * purchase list route returns no records for these accounts (checked 2026-10-17).
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

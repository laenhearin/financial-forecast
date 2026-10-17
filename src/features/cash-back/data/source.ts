import { isISODate } from "../../../lib/dates";
import { dollarsToCents, isCents } from "../../../lib/money";
import { findCard } from "../cards/library";
import type { ISODate, Purchase } from "../types";
import { DEMO_AS_OF_DATE, DEMO_CUSTOMER, DEMO_OWNED_CARD_IDS, DEMO_PURCHASES } from "./demoPurchases";

/** Normalized purchase history, in cents. */
export interface CashBackData {
  customerName: string;
  /** The data's "today", YYYY-MM-DD. Windows end on this date. */
  asOfDate: ISODate;
  /** Cards the customer owns; the starting card selection. */
  ownedCardIds: string[];
  purchases: Purchase[];
}

export interface CashBackDataSource {
  /** Shown in the UI so fixture data is always labelled. */
  readonly sourceLabel: string;
  readonly isFixture: boolean;
  load(): Promise<CashBackData>;
}

export class CashBackLoadError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = "CashBackLoadError";
  }
}

/** Returns one message per problem; an empty list means the data is usable. */
export function validateCashBackData(data: CashBackData): string[] {
  const problems: string[] = [];
  if (!isISODate(data.asOfDate)) problems.push(`As-of date "${data.asOfDate}" is not a YYYY-MM-DD date.`);
  for (const id of data.ownedCardIds) if (!findCard(id)) problems.push(`Owned card "${id}" is not in the card library.`);
  const ids = new Set<string>();
  for (const purchase of data.purchases) {
    const label = `Purchase ${purchase.id} (${purchase.merchant})`;
    if (ids.has(purchase.id)) problems.push(`${label} has a duplicate id.`);
    ids.add(purchase.id);
    if (!isISODate(purchase.date)) problems.push(`${label} has an invalid date "${purchase.date}".`);
    else if (isISODate(data.asOfDate) && purchase.date > data.asOfDate) problems.push(`${label} is dated after the as-of date.`);
    if (!isCents(purchase.amountCents) || purchase.amountCents <= 0) problems.push(`${label} needs a positive amount.`);
    if (!purchase.merchant.trim()) problems.push(`${label} has no merchant name.`);
    if (!findCard(purchase.cardId)) problems.push(`${label} uses card "${purchase.cardId}", which is not in the card library.`);
    else if (!data.ownedCardIds.includes(purchase.cardId)) problems.push(`${label} uses card "${purchase.cardId}", which the customer does not own.`);
  }
  return problems;
}

/** The only module that reads the demo file. Throws CashBackLoadError when validation finds problems. */
export function loadDemoCashBackData(): CashBackData {
  const data: CashBackData = {
    customerName: DEMO_CUSTOMER,
    asOfDate: DEMO_AS_OF_DATE,
    ownedCardIds: [...DEMO_OWNED_CARD_IDS],
    purchases: DEMO_PURCHASES.map(([date, merchant, dollars, cardId], index) => ({
      id: `demo-${String(index + 1).padStart(3, "0")}`,
      date,
      merchant,
      amountCents: dollarsToCents(dollars),
      cardId,
    })),
  };
  const problems = validateCashBackData(data);
  if (problems.length) throw new CashBackLoadError("The demo purchase data is invalid.", problems);
  return data;
}

export const demoCashBackSource: CashBackDataSource = {
  sourceLabel: "Demo data",
  isFixture: true,
  async load() {
    return loadDemoCashBackData();
  },
};

/**
 * Stub for live data. Not wired up, because the documented Nessie API cannot supply purchase history yet.
 *
 * Checked 2026-10-17 against the OpenAPI spec the Nessie docs page loads
 * (https://prod.nessieisreal.com/nessie-openapi-spec.yaml, served from https://prod-api.nessieisreal.com):
 * - There is no endpoint that lists an account's purchases. Purchases are only readable one at a time,
 *   by id, at GET /purchase/{purchase_id}, and that response has no documented schema.
 * - GET /customers/{id}/accounts returns accounts with `type` ("Credit Card" | "Savings" | "Checking")
 *   and `nickname`, which could identify which library card each credit card account is.
 * - GET /merchants/{id} returns `name` and `category` (documented as a string; the docs example shows an array).
 * - Authentication is a `key` query parameter.
 * A real version must stay read-only, run on the server (the API key never reaches the browser), and
 * return the normalized CashBackData above through a route. Confirm a purchase-list endpoint first.
 */
export const nessieCashBackSource: CashBackDataSource = {
  sourceLabel: "Nessie (not connected)",
  isFixture: false,
  async load() {
    throw new CashBackLoadError("Live Nessie purchases are not available yet.", [
      "The current Nessie API documents no endpoint that lists an account's purchases.",
      "Switch to the demo data source in useCashBack.ts.",
    ]);
  },
};

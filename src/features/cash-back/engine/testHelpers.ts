import { findCard } from "../cards/library";
import type { CardDefinition, CategorizedPurchase, Category } from "../types";

let counter = 0;

/** A categorized purchase for tests. Amounts are cents. */
export function buy(date: string, category: Category, amountCents: number, cardId: string, merchant: string = category): CategorizedPurchase {
  counter += 1;
  return { id: `t-${String(counter).padStart(4, "0")}`, date, merchant, amountCents, cardId, category, categorySource: "keyword" };
}

export function card(id: string): CardDefinition {
  const found = findCard(id);
  if (!found) throw new Error(`No card ${id} in the library.`);
  return found;
}

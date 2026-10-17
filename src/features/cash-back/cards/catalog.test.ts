import { describe, expect, it } from "vitest";
import { isISODate } from "../../../lib/dates";
import { isCategoryId, type CategoryId, type CreditCard, type SpendCap } from "../types";
import { CARD_CATALOG, cardsByIds, findCard, LEGACY_CARD_IDS, resolveCardId } from "./catalog";

/** Every category id a card mentions, from any rule. */
function categoriesUsed(card: CreditCard): string[] {
  const caps = capsOf(card).flatMap(({ cap }) => cap.sharedWith ?? []);
  return [
    ...card.categoryRules.map(rule => rule.category),
    ...Object.keys(card.rotating?.rates ?? {}),
    ...(card.selectable?.options ?? []),
    ...(card.selectable?.defaultChoices ?? []),
    ...caps,
  ];
}

/** Every cap with the categories it covers (its own plus sharedWith). */
function capsOf(card: CreditCard): { cap: SpendCap; covers: CategoryId[] }[] {
  const caps: { cap: SpendCap; covers: CategoryId[] }[] = [];
  for (const rule of card.categoryRules) if (rule.cap) caps.push({ cap: rule.cap, covers: [rule.category, ...(rule.cap.sharedWith ?? [])] });
  if (card.selectable?.cap) caps.push({ cap: card.selectable.cap, covers: [...card.selectable.options, ...(card.selectable.cap.sharedWith ?? [])] });
  if (card.rotating) caps.push({ cap: card.rotating.cap, covers: [...(Object.keys(card.rotating.rates) as CategoryId[]), ...(card.rotating.cap.sharedWith ?? [])] });
  return caps;
}

function ratesOf(card: CreditCard): number[] {
  return [
    card.baseRate,
    ...card.categoryRules.map(rule => rule.rate),
    ...Object.values(card.rotating?.rates ?? {}),
    ...(card.selectable ? [card.selectable.rate] : []),
    ...(card.merchantRules ?? []).map(rule => rule.rate),
    ...capsOf(card).flatMap(({ cap }) => (cap.rateAfterCap === undefined ? [] : [cap.rateAfterCap])),
  ];
}

const HEX = /^#[0-9a-f]{6}$/i;

describe("card catalog", () => {
  it("has exactly 30 cards with unique ids and popularity ranks 1 to 30", () => {
    expect(CARD_CATALOG).toHaveLength(30);
    expect(new Set(CARD_CATALOG.map(card => card.id)).size).toBe(30);
    expect(CARD_CATALOG.map(card => card.popularityRank).sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("over-represents Capital One", () => {
    expect(CARD_CATALOG.filter(card => card.issuer === "Capital One").length).toBeGreaterThanOrEqual(10);
  });

  it("uses kebab-case ids", () => {
    for (const card of CARD_CATALOG) expect(card.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("only uses the 14 standard category ids", () => {
    for (const card of CARD_CATALOG) {
      for (const category of categoriesUsed(card)) expect(isCategoryId(category), `${card.id}: ${category}`).toBe(true);
    }
  });

  it("keeps rates, fees, and caps in range", () => {
    for (const card of CARD_CATALOG) {
      for (const rate of ratesOf(card)) {
        expect(rate, card.id).toBeGreaterThan(0);
        expect(rate, card.id).toBeLessThanOrEqual(12);
        // Rates convert to whole basis points, so the money math stays in integers.
        expect(Number.isInteger(rate * 100), `${card.id}: ${rate}`).toBe(true);
      }
      expect(Number.isSafeInteger(card.annualFeeCents) && card.annualFeeCents >= 0, card.id).toBe(true);
      expect(card.pointValueCents, card.id).toBeGreaterThan(0);
      for (const { cap } of capsOf(card)) expect(Number.isSafeInteger(cap.amountCents) && cap.amountCents > 0, card.id).toBe(true);
    }
  });

  it("has at most one rule per category on each card", () => {
    for (const card of CARD_CATALOG) {
      const categories = card.categoryRules.map(rule => rule.category);
      expect(new Set(categories).size, card.id).toBe(categories.length);
    }
  });

  it("keeps caps that share categories on one card identical", () => {
    for (const card of CARD_CATALOG) {
      const caps = capsOf(card);
      for (const a of caps) {
        for (const b of caps) {
          if (a === b || !a.covers.some(category => b.covers.includes(category))) continue;
          expect(new Set(a.covers), card.id).toEqual(new Set(b.covers));
          expect([a.cap.amountCents, a.cap.period], card.id).toEqual([b.cap.amountCents, b.cap.period]);
        }
      }
    }
  });

  it("has valid rotating date ranges", () => {
    const rotating = CARD_CATALOG.flatMap(card => (card.rotating ? [card.rotating] : []));
    expect(rotating.length).toBeGreaterThan(0);
    for (const block of rotating) {
      expect(isISODate(block.startDate) && isISODate(block.endDate)).toBe(true);
      expect(block.startDate < block.endDate).toBe(true);
      expect(Object.keys(block.rates).length).toBeGreaterThan(0);
    }
  });

  it("has valid selectable blocks", () => {
    const selectable = CARD_CATALOG.flatMap(card => (card.selectable ? [card.selectable] : []));
    expect(selectable.length).toBe(3);
    for (const block of selectable) {
      expect(block.defaultChoices).toHaveLength(block.picks);
      expect(new Set(block.defaultChoices).size).toBe(block.picks);
      for (const choice of block.defaultChoices) expect(block.options).toContain(choice);
    }
  });

  it("has valid visuals, highlights, and verification dates", () => {
    for (const card of CARD_CATALOG) {
      expect(card.visual.gradientFrom, card.id).toMatch(HEX);
      expect(card.visual.gradientTo, card.id).toMatch(HEX);
      expect(card.visual.textColor, card.id).toMatch(HEX);
      expect(isISODate(card.lastVerified), card.id).toBe(true);
      expect(card.highlights.length, card.id).toBeGreaterThanOrEqual(1);
      expect(card.highlights.length, card.id).toBeLessThanOrEqual(3);
    }
  });

  it("finds cards by id and maps the old sample ids to real cards", () => {
    expect(findCard("capital-one-savor")?.name).toBe("Savor");
    expect(findCard("nope")).toBeUndefined();
    expect(cardsByIds(["citi-double-cash", "nope", "capital-one-savor"]).map(card => card.id)).toEqual(["capital-one-savor", "citi-double-cash"]);
    expect(resolveCardId("steady-2")).toBe("citi-double-cash");
    expect(resolveCardId("capital-one-savor")).toBe("capital-one-savor");
    expect(resolveCardId("constructor")).toBeUndefined();
    for (const id of Object.values(LEGACY_CARD_IDS)) expect(findCard(id), id).toBeDefined();
  });
});

import { clampedDate, daysBetween, daysInMonth, dateParts } from "../../../lib/dates";
import type { Bps, CapPeriod, CategoryId, Cents, ISODate } from "../types";
import type { WalletAnalysis } from "./analyze";

export interface LineupCategory {
  category: CategoryId;
  rateBps: Bps;
  rotating: boolean;
}

/** A bonus cap that runs out before its period ends at the current spending. */
export interface LineupCapNote {
  remainingCents: Cents;
  rateBps: Bps;
  period: CapPeriod;
  /** What takes over once the cap is used up, per card. */
  then: { cardId: string; rateBps: Bps; categories: CategoryId[] }[];
}

export interface LineupRow {
  cardId: string;
  /** Categories this card wins, most spend first. */
  categories: LineupCategory[];
  capNotes: LineupCapNote[];
}

export interface Lineup {
  rows: LineupRow[];
  /** Owned cards that win no category with spend. */
  unusedCardIds: string[];
}

/** Last day of the calendar month, quarter, or year containing `date`. */
function periodEnd(date: ISODate, period: CapPeriod): ISODate {
  const { year, month } = dateParts(date);
  const endMonth = period === "month" ? month : period === "quarter" ? Math.ceil(month / 3) * 3 : 12;
  return clampedDate(year, endMonth, daysInMonth(year, endMonth));
}

/**
 * Which owned card to use for each category with spending, grouped by card in the order of the
 * spend each card wins. A cap note appears only when the cap would run out before its period ends
 * at the current monthly spending, since that is when the next-best card takes over.
 */
export function buildLineup(analysis: WalletAnalysis, today: ISODate): Lineup {
  const rows: LineupRow[] = analysis.gold.map(gold => {
    const won = analysis.winners.filter(item => item.winner?.cardId === gold.cardId && item.monthlySpendCents > 0);
    const categories = gold.categories.map(category => {
      const winner = won.find(item => item.category === category)!.winner!;
      return { category, rateBps: winner.rateBps, rotating: winner.source === "rotating" };
    });

    const pools = new Map<string, typeof won>();
    for (const item of [...won].sort((a, b) => b.monthlySpendCents - a.monthlySpendCents)) {
      const key = item.winner?.pool?.key;
      if (key) pools.set(key, [...(pools.get(key) ?? []), item]);
    }
    const capNotes: LineupCapNote[] = [];
    for (const items of pools.values()) {
      const { pool, capRemainingCents, rateBps } = items[0].winner!;
      if (!pool || capRemainingCents === null) continue;
      const monthlyCents = items.reduce((sum, item) => sum + item.monthlySpendCents, 0);
      const daysLeft = daysBetween(today, periodEnd(today, pool.cap.period)) + 1;
      const neededCents = Math.round((monthlyCents * 12 * daysLeft) / 365);
      if (neededCents <= capRemainingCents) continue;
      const then: LineupCapNote["then"] = [];
      for (const item of items) {
        if (!item.runnerUp) continue;
        const existing = then.find(entry => entry.cardId === item.runnerUp!.cardId);
        if (existing) existing.categories.push(item.category);
        else then.push({ cardId: item.runnerUp.cardId, rateBps: item.runnerUp.rateBps, categories: [item.category] });
      }
      capNotes.push({ remainingCents: capRemainingCents, rateBps, period: pool.cap.period, then });
    }
    return { cardId: gold.cardId, categories, capNotes };
  });

  const winning = new Set(rows.map(row => row.cardId));
  return { rows, unusedCardIds: analysis.owned.map(card => card.id).filter(id => !winning.has(id)) };
}

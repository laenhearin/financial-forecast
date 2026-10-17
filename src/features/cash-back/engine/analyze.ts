import { addDays } from "../../../lib/dates";
import { CARD_LIBRARY, cardsByIds, findCard } from "../cards/library";
import type { CashBackAnalysis, CategorizedPurchase, ISODate, WindowDays } from "../types";
import { buildPlaybook } from "./playbook";
import { actualCapLedger, annualizeCents, computeRewards, flagWrongCardPurchases } from "./rewards";
import { suggestNewCard } from "./suggest";

export interface AnalyzeInput {
  /** All loaded purchases, already categorized. Purchases before the window still warm up cap ledgers. */
  purchases: readonly CategorizedPurchase[];
  selectedCardIds: readonly string[];
  asOfDate: ISODate;
  windowDays: WindowDays;
}

/** First day of a window that ends on (and includes) the as-of date. */
export function windowStartDate(asOfDate: ISODate, windowDays: WindowDays): ISODate {
  return addDays(asOfDate, -(windowDays - 1));
}

/** Runs the whole engine for one set of inputs. Pure and deterministic. */
export function analyzeCashBack({ purchases, selectedCardIds, asOfDate, windowDays }: AnalyzeInput): CashBackAnalysis {
  const selected = cardsByIds(selectedCardIds);
  const windowStart = windowStartDate(asOfDate, windowDays);
  const history = purchases.filter(purchase => purchase.date <= asOfDate);
  const inWindow = history.filter(purchase => purchase.date >= windowStart);

  const rewards = computeRewards(history, selected, { from: windowStart, findCard });
  const ledger = actualCapLedger(history, findCard);
  return {
    asOfDate,
    windowDays,
    windowStart,
    purchaseCount: inWindow.length,
    spendCents: inWindow.reduce((sum, purchase) => sum + purchase.amountCents, 0),
    rewards,
    missedAnnualCents: annualizeCents(Math.max(0, rewards.missedCents), windowDays),
    flags: flagWrongCardPurchases(rewards),
    playbook: buildPlaybook(selected, inWindow, asOfDate, ledger),
    suggestion: suggestNewCard(history, selected, CARD_LIBRARY, { from: windowStart, windowDays, findCard }),
  };
}

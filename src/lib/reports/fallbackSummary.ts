import { formatUSD } from "../money";
import type { SummaryStats } from "./types";
export function buildFallbackSummary(stats: SummaryStats): string {
  const { incomeCents: income, spendingCents: spending, netCents: net } = stats.totals;
  const sentences = [spending === 0 ? `You have no recorded spending in this period, with ${formatUSD(income)} in recorded income.` : `You received ${formatUSD(income)} and spent ${formatUSD(spending)} in this period.`];
  sentences.push(net < 0 ? `Your spending exceeded income by ${formatUSD(-net)}.` : `Your recorded net cash flow was ${formatUSD(net)}.`);
  if (stats.topCategories.length) sentences.push(`Your largest spending category was ${stats.topCategories[0].category}, at ${formatUSD(stats.topCategories[0].amountCents)}.`);
  if (stats.previous) sentences.push(`Your previous period had ${formatUSD(stats.previous.spendingCents)} in spending and ${formatUSD(stats.previous.incomeCents)} in income.`);
  if (stats.forecast) sentences.push(`Your lowest projected balance is ${formatUSD(stats.forecast.lowestBalanceCents)} on ${stats.forecast.lowestBalanceDate}; check upcoming bills before making new plans.`);
  if (sentences.length < 3) sentences.push("Review your recorded activity for missing items before using this report to make plans.");
  // Keep a short paragraph, including the category and comparison when available.
  return sentences.join(" ");
}

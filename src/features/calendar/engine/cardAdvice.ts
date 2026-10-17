import { formatUSD } from "../../../lib/money";
import type { AdviceItem, Cents, CreditCard } from "../types";

const apr = (card: CreditCard) => `${card.aprPercent.toFixed(2)}%`;

export function cardSummary(card: CreditCard): string {
  const utilization = card.limitCents > 0 ? (card.balanceCents / card.limitCents) * 100 : 0;
  const available = Math.max(0, card.limitCents - card.balanceCents);
  return `APR ${apr(card)} · Balance ${formatUSD(card.balanceCents)} / ${formatUSD(card.limitCents)} · ${formatUSD(available)} available · ${utilization.toFixed(0)}% utilization${card.rewards ? ` · ${card.rewards}` : ""}`;
}

interface RankedCard extends CreditCard {
  newBalanceCents: Cents;
  utilization: number;
  score: number;
}

/** Lower is better. APR and utilization outweigh rewards, and carrying a balance counts against a card. */
export function cardScore(card: CreditCard, amountCents: Cents): RankedCard {
  const newBalanceCents = card.balanceCents + amountCents;
  const utilization = newBalanceCents / card.limitCents;
  const score = card.aprPercent * 1.7 + utilization * 100 + (card.balanceCents > 0 ? 12 : 0) - (card.rewards ? 2 : 0);
  return { ...card, newBalanceCents, utilization, score };
}

/** Estimates which entered card fits a planned purchase. General guidance, not issuer advice. */
export function compareCards(cards: readonly CreditCard[], amountCents: Cents | null): AdviceItem[] {
  if (cards.length === 0) {
    return [
      {
        id: "no-cards",
        title: "Add your card details first",
        tag: "Missing details",
        tone: "medium",
        text: "Enter at least one card's APR, current balance, and credit limit before comparing options.",
        meta: "Never enter a full card number, CVV, PIN, or banking password.",
      },
    ];
  }
  if (amountCents === null || amountCents <= 0) {
    return [
      {
        id: "no-amount",
        title: "Enter a purchase amount",
        tag: "Missing amount",
        tone: "info",
        text: "Enter the amount you expect to spend so the app can estimate each card's post-purchase utilization.",
      },
    ];
  }

  const eligible = cards.filter((card) => card.limitCents - card.balanceCents >= amountCents);
  if (eligible.length === 0) {
    return [
      {
        id: "over-limit",
        title: "No card has enough listed available credit",
        tag: "Avoid over-limit risk",
        tone: "high",
        text: "The purchase amount exceeds the listed available credit on every card. Consider delaying the purchase, choosing a lower-cost option, or using available cash only if doing so leaves enough for essentials.",
        meta: "Issuer authorizations and pending transactions can make actual available credit lower.",
      },
    ];
  }

  const carriesBalance = eligible.some((card) => card.balanceCents > 0);
  const ranked = eligible.map((card) => cardScore(card, amountCents)).sort((a, b) => a.score - b.score);
  const [best, ...rest] = ranked;
  const utilizationText = (card: RankedCard) => `${(card.utilization * 100).toFixed(1)}%`;

  const items: AdviceItem[] = [
    {
      id: `best-${best.id}`,
      title: `First card to consider: ${best.name}`,
      tag: "Best estimate",
      tone: "ok",
      text: carriesBalance
        ? `At least one listed card has a balance. If you will carry this purchase past the grace period, interest can outweigh rewards. Compare APR and consider whether you can avoid adding new debt. ${best.name} has the lowest estimated combination of APR and post-purchase utilization among the eligible cards entered.`
        : `Among the cards entered with enough available credit, ${best.name} has the lowest estimated combination of APR and post-purchase utilization. If you pay the statement balance in full by the due date and qualify for a grace period, rewards may be worth comparing too.`,
      meta: `APR ${apr(best)} · Estimated post-purchase balance ${formatUSD(best.newBalanceCents)} · Estimated utilization ${utilizationText(best)}${best.rewards ? ` · Rewards: ${best.rewards}` : ""}`,
    },
  ];
  for (const card of rest) {
    items.push({
      id: `alt-${card.id}`,
      title: card.name,
      tag: "Alternative",
      tone: "info",
      text: `Estimated post-purchase balance: ${formatUSD(card.newBalanceCents)}. Estimated utilization: ${utilizationText(card)}. ${
        card.aprPercent > best.aprPercent
          ? "Its APR is higher than the first suggestion."
          : "Its APR is not higher, so compare fees, rewards, grace-period rules, and any purchase-specific benefits."
      }`,
      meta: `APR ${apr(card)}${card.rewards ? ` · Rewards: ${card.rewards}` : ""}`,
    });
  }
  items.push({
    id: "before-you-use",
    title: "Before you use a card",
    tag: "Important",
    tone: "medium",
    text: "Check the card's actual terms and whether the purchase qualifies for a grace period or promotional APR. Paying the statement balance in full by the due date is generally the best way to avoid purchase interest when the account has a grace period.",
    meta: "This is a simple estimate, not financial advice from your card issuer. It does not model fees, promotional rates, reward caps, pending transactions, or issuer-specific rules.",
  });
  return items;
}

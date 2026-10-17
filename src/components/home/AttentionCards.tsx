import Link from "next/link";
import { CreditCard, Target, Umbrella, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardData } from "./types";

const ICONS: Record<CardData["icon"], LucideIcon> = {
  umbrella: Umbrella,
  target: Target,
  "credit-card": CreditCard,
};

/** Badge tint and icon color per tone. */
const TONES: Record<CardData["tone"], string> = {
  rain: "bg-rain-soft text-rain",
  accent: "bg-accent-soft text-accent",
  sun: "bg-sun-soft text-sun",
};

const grid = "grid grid-cols-1 gap-5 md:grid-cols-3";

interface AttentionCardsProps {
  cards: CardData[];
  /** Swaps the cards for placeholder blocks (not wired up yet). */
  isLoading?: boolean;
  className?: string;
}

export function AttentionCards({ cards, isLoading = false, className }: AttentionCardsProps) {
  if (isLoading) {
    return (
      <div aria-busy="true" className={cn(grid, className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-38 animate-pulse rounded-panel bg-skeleton motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  return (
    <ul className={cn(grid, className)}>
      {cards.map((card) => {
        const Icon = ICONS[card.icon];
        return (
          <li key={card.id} className="flex">
            <Link
              href={card.href}
              className="ui-transition flex w-full flex-col gap-1.5 rounded-panel border border-app bg-card px-4.5 py-5 hover:border-accent-line"
            >
              <span aria-hidden className={cn("mb-0.5 flex size-9 items-center justify-center rounded-full", TONES[card.tone])}>
                <Icon className="size-4.5" strokeWidth={1.75} />
              </span>
              <span className="text-body font-medium text-primary">{card.title}</span>
              <span className="text-caption text-secondary">{card.subtitle}</span>
              <span className="text-caption font-medium text-accent">{card.actionLabel}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

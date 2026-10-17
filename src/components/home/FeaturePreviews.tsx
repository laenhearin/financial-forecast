"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, CreditCard, ShoppingCart, Target, Umbrella, type LucideIcon } from "lucide-react";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import type { HomeData } from "./types";
import type { Goal } from "@/features/big-purchase/types";
import { goalStore } from "@/features/big-purchase/state/goalStore";
import { cn } from "@/lib/utils";
import type { CashBackData } from "@/features/cash-back/data/source";
import { homeMessage } from "@/features/cash-back/engine/homeMessage";
import { useCashBack } from "@/features/cash-back/hooks/useCashBack";

type Feature = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tag?: string;
  tone: "blue" | "yellow" | "mint" | "slate";
};

const FEATURES: Feature[] = [
  {
    title: "Forecast Fund",
    description: "Plan a goal and see how contributions affect your forecast.",
    href: ROUTES.bigPurchase,
    icon: Target,
    tone: "yellow",
  },
  {
    title: "Swipe and Shine",
    description: "Review rewards and find cards that fit your spending to maximize your cash back.",
    href: ROUTES.cashBack,
    icon: CreditCard,
    tone: "yellow",
  },
  {
    title: "Storm solver",
    description: "Review upcoming tight spots and ways to prepare.",
    href: ROUTES.stormSolver,
    icon: Umbrella,
    tone: "slate",
  },
  {
    title: "Purchase advisor",
    description: "Preview how a purchase changes your projected balances, then add it to your calendar.",
    href: ROUTES.purchaseAdvisor,
    icon: ShoppingCart,
    tone: "blue",
  },
];

const TONES = {
  blue: "bg-accent-soft text-accent",
  yellow: "bg-sun-soft text-sun",
  mint: "bg-rain-soft text-rain",
  slate: "bg-secondary text-secondary",
} as const;

export function FeaturePreviews({ homeData, demoGoal }: { homeData: HomeData; cashBackData: CashBackData; demoGoal: Goal }) {
  const storedGoal = useSyncExternalStore(goalStore.subscribe, goalStore.getSnapshot, goalStore.getServerSnapshot);
  // Same functions as the Cash Back page; null until local storage has been read on the client.
  // The seeded profile's purchases (cashBackData) are too sparse to price cards, so the tile uses the demo spending profile.
  const { analysis: cashBackAnalysis } = useCashBack();
  const cashBack = useMemo(() => (cashBackAnalysis ? homeMessage(cashBackAnalysis) : null), [cashBackAnalysis]);

  const projectionLow = homeData.projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
  const goal = storedGoal?.goals[0] ?? demoGoal;
  const progressByTitle: Record<string, { label: string; detail: string; percent?: number; figure?: string; href?: string; loading?: boolean; gold?: boolean }> = {
    "Forecast Fund": {
      label: goal ? `${goal.name || "Untitled goal"} · ${formatUSD(goal.costCents)}` : "No saved goal yet",
      detail: goal ? `${goal.status === "active" ? "Active" : "Draft"} · ${goal.contributionCents === null ? "Suggested contribution" : `${formatUSD(goal.contributionCents)} per paycheck`}` : "Open Forecast Fund to start a goal.",
      percent: goal ? (Number(Boolean(goal.name.trim())) + Number(goal.costCents > 0)) * 50 : 0,
    },
    "Swipe and Shine": {
      label: cashBack?.title ?? "",
      detail: cashBack?.body ?? "",
      figure: cashBack?.figure,
      href: cashBack?.kind === "suggestion" ? `${ROUTES.cashBack}?suggest=${cashBack.cardId}` : undefined,
      loading: cashBack === null,
      gold: true,
    },
    "Storm solver": {
      label: `Next tight spot · ${homeData.nextStormLabel ?? "No date flagged"}`,
      detail: `${formatUSD(projectionLow.balanceCents)} projected low on day ${projectionLow.day}`,
    },
    "Purchase advisor": {
      label: "Ready to plan a purchase",
      detail: "Preview its effect over the coming weeks.",
    },
  };

  const features = [FEATURES[2], FEATURES[0], FEATURES[1], FEATURES[3]];

  return (
    <section
      aria-labelledby="feature-previews-title"
      className="h-full"
    >
          <h2 id="feature-previews-title" className="sr-only">
            Explore your tools
          </h2>
      <div className="grid h-full gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-4">
        {features.map(({ title, description, href, icon: Icon, tag, tone }) => {
          const progress = progressByTitle[title];
          return (
            <Link
              key={title}
              href={progress.href ?? href}
              className="ui-transition group flex min-w-0 flex-col rounded-panel border border-app bg-card p-3 hover:border-accent-line hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-8 items-center justify-center rounded-item ${TONES[tone]}`}>
                  <Icon aria-hidden className="size-4.5" strokeWidth={1.75} />
                </span>
                {tag ? (
                  <span className="rounded-chip bg-secondary px-2 py-1 text-micro font-medium text-secondary">{tag}</span>
                ) : (
                  <ArrowUpRight aria-hidden className="size-4 text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                )}
              </div>
              <h3 className="mt-2 text-body font-medium text-primary">{title}</h3>
              <p className="mt-1 text-caption text-secondary">{description}</p>
              {progress.loading ? (
                <div aria-busy="true" aria-label={`Loading ${title}`} className="mt-2 h-17 animate-pulse rounded-item bg-skeleton motion-reduce:animate-none" />
              ) : (
                <div className={cn("mt-2 rounded-item bg-app px-3 py-2.5", progress.gold && "border-l-2 border-gold")}>
                  <p className="wrap-break-word text-caption font-medium text-primary">{progress.label}</p>
                  <p className={cn("mt-0.5 text-micro text-secondary", "wrap-break-word")}>{progress.detail}</p>
                  {progress.figure && <p className="mt-1 text-caption font-semibold text-gold-ink">{progress.figure}</p>}
                  {progress.percent !== undefined && (
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
                      role="progressbar"
                      aria-label={`${title} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress.percent}
                    >
                      <span className={`block h-full rounded-full ${tone === "yellow" ? "bg-sun" : "bg-accent"}`} style={{ width: `${progress.percent}%` }} />
                    </div>
                  )}
                </div>
              )}
              <span className="jump-link mt-2 self-start">
                {tag ? "Preview feature" : `Open ${title}`}
                <ArrowRight aria-hidden className="size-4" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

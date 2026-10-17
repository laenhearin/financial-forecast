"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, CreditCard, ShoppingCart, Target, Umbrella, type LucideIcon } from "lucide-react";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { HomeData } from "./types";
import { goalStore } from "@/features/big-purchase/state/goalStore";
import type { Goal } from "@/features/big-purchase/types";
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
    title: "Weather Calendar",
    description: "See bills, income, and projected balances by day.",
    href: ROUTES.calendar,
    icon: CalendarDays,
    tone: "blue",
  },
  {
    title: "Purchase Forecasting",
    description: "Plan a goal and see how contributions affect your forecast.",
    href: ROUTES.bigPurchase,
    icon: Target,
    tone: "yellow",
  },
  {
    title: "Change of Weather",
    description: "Review rewards and find cards that fit your spending to maximize your cash back.",
    href: ROUTES.cashBack,
    icon: CreditCard,
    tone: "yellow",
  },
  {
    title: "Storm solver",
    description: "Review upcoming tight spots and ways to prepare.",
    href: ROUTES.calendar,
    icon: Umbrella,
    tone: "slate",
  },
  {
    title: "Purchase advisor",
    description: "Get help weighing a purchase against your budget.",
    href: ROUTES.purchaseAdvisor,
    icon: ShoppingCart,
    tag: "Coming soon",
    tone: "blue",
  },
];

const TONES = {
  blue: "bg-accent-soft text-accent",
  yellow: "bg-sun-soft text-sun",
  mint: "bg-rain-soft text-rain",
  slate: "bg-secondary text-secondary",
} as const;

export function FeaturePreviews({ placement, homeData, demoGoal }: { placement: "side" | "below"; homeData: HomeData; cashBackData: CashBackData; demoGoal: Goal }) {
  const storedGoal = useSyncExternalStore(goalStore.subscribe, goalStore.getSnapshot, goalStore.getServerSnapshot);
  // Same functions as the Cash Back page; null until local storage has been read on the client.
  // The seeded profile's purchases (cashBackData) are too sparse to price cards, so the tile uses the demo spending profile.
  const { analysis: cashBackAnalysis } = useCashBack();
  const cashBack = useMemo(() => (cashBackAnalysis ? homeMessage(cashBackAnalysis) : null), [cashBackAnalysis]);

  const projectionLow = homeData.projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
  const goal = storedGoal?.goals[0] ?? demoGoal;
  const progressByTitle: Record<string, { label: string; detail: string; percent?: number; figure?: string; href?: string; loading?: boolean; gold?: boolean }> = {
    "Weather Calendar": {
      label: `${homeData.projection.at(-1)?.day ?? 30}-day balance outlook`,
      detail: `${homeData.markers.length} upcoming events · low ${formatUSD(projectionLow.balanceCents)}`,
    },
    "Purchase Forecasting": {
      label: `${goal.name || "Untitled goal"} · ${formatUSD(goal.costCents)}`,
      detail: `${goal.status === "active" ? "Active" : "Draft"} · ${goal.contributionCents === null ? "Suggested contribution" : `${formatUSD(goal.contributionCents)} per paycheck`}`,
      percent: (Number(Boolean(goal.name.trim())) + Number(goal.costCents > 0)) * 50,
    },
    "Change of Weather": {
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
      label: "Coming soon",
      detail: "Progress will appear here when the feature is available.",
    },
  };

  const features = FEATURES.filter((feature) =>
    placement === "side"
      ? feature.title !== "Storm solver" && feature.title !== "Purchase advisor"
      : feature.title === "Storm solver" || feature.title === "Purchase advisor",
  );

  return (
    <section
      aria-labelledby={`feature-previews-title-${placement}`}
      className={placement === "side" ? "lg:sticky lg:top-8" : "mt-8"}
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id={`feature-previews-title-${placement}`} className="text-figure font-medium text-primary">
            {placement === "side" ? "Explore your tools" : "More tools"}
          </h2>
          {placement === "side" && <p className="mt-1 text-caption text-secondary">Jump into a feature or take a quick look first.</p>}
        </div>
      </div>
      <div className={`grid gap-3 ${placement === "below" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-1"}`}>
        {features.map(({ title, description, href, icon: Icon, tag, tone }) => {
          const progress = progressByTitle[title];
          return (
            <Link
              key={title}
              href={progress.href ?? href}
              className="ui-transition group flex min-h-42 flex-col rounded-panel border border-app bg-card p-4 hover:border-accent-line hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-9 items-center justify-center rounded-item ${TONES[tone]}`}>
                  <Icon aria-hidden className="size-4.5" strokeWidth={1.75} />
                </span>
                {tag ? (
                  <span className="rounded-chip bg-secondary px-2 py-1 text-micro font-medium text-secondary">{tag}</span>
                ) : (
                  <ArrowUpRight aria-hidden className="size-4 text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                )}
              </div>
              <h3 className="mt-3 text-body font-medium text-primary">{title}</h3>
              <p className="mt-1 min-h-10 text-caption text-secondary">{description}</p>
              {progress.loading ? (
                <div aria-busy="true" aria-label={`Loading ${title}`} className="mt-auto h-17 animate-pulse rounded-item bg-skeleton motion-reduce:animate-none" />
              ) : (
                <div className={cn("mt-auto rounded-item bg-app px-3 py-2.5", progress.gold && "border-l-2 border-gold")}>
                  <p className="truncate text-caption font-medium text-primary">{progress.label}</p>
                  <p className={cn("mt-0.5 text-micro text-secondary", !progress.figure && "truncate")}>{progress.detail}</p>
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
              <span className="jump-link mt-3 self-start">
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

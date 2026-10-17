"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight, ArrowUpRight, CreditCard, Target, Umbrella, type LucideIcon } from "lucide-react";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import type { HomeData } from "./types";
import type { Goal } from "@/features/big-purchase/types";
import { goalStore } from "@/features/big-purchase/state/goalStore";
import { analyzeCashBack } from "@/features/cash-back/engine/analyze";
import { categorize } from "@/features/cash-back/engine/categorize";
import type { CashBackData } from "@/features/cash-back/data/source";
import { prefsStore } from "@/features/cash-back/state/prefsStore";

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

];

const TONES = {
  blue: "bg-accent-soft text-accent",
  yellow: "bg-sun-soft text-sun",
  mint: "bg-rain-soft text-rain",
  slate: "bg-secondary text-secondary",
} as const;

export function FeaturePreviews({ homeData, cashBackData, demoGoal }: { homeData: HomeData; cashBackData: CashBackData; demoGoal: Goal }) {
  const storedGoal = useSyncExternalStore(goalStore.subscribe, goalStore.getSnapshot, goalStore.getServerSnapshot);
  const cashPrefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.getSnapshot, prefsStore.getServerSnapshot);
  const cashBackProgress = useMemo(() => {
    const data = cashBackData;
    const analysis = analyzeCashBack({
      purchases: categorize(data.purchases),
      selectedCardIds: cashPrefs?.selectedCardIds ?? data.ownedCardIds,
      asOfDate: data.asOfDate,
      windowDays: cashPrefs?.windowDays ?? 90,
    });
    return analysis;
  }, [cashPrefs, cashBackData]);

  const projectionLow = homeData.projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
  const goal = storedGoal?.goals[0] ?? demoGoal;
  const progressByTitle: Record<string, { label: string; detail: string; percent?: number }> = {
    "Purchase Forecasting": {
      label: goal ? `${goal.name || "Untitled goal"} · ${formatUSD(goal.costCents)}` : "No saved goal yet",
      detail: goal ? `${goal.status === "active" ? "Active" : "Draft"} · ${goal.contributionCents === null ? "Suggested contribution" : `${formatUSD(goal.contributionCents)} per paycheck`}` : "Open Purchase Forecasting to start a goal.",
      percent: goal ? (Number(Boolean(goal.name.trim())) + Number(goal.costCents > 0)) * 50 : 0,
    },
    "Change of Weather": {
      label: `${formatUSD(cashBackProgress.rewards.actualCents)} rewards earned`,
      detail: `${cashBackProgress.purchaseCount} purchases · ${formatUSD(cashBackProgress.rewards.missedCents)} potential rewards missed`,
      percent: cashBackProgress.rewards.bestCents > 0 ? Math.round((cashBackProgress.rewards.actualCents / cashBackProgress.rewards.bestCents) * 100) : 0,
    },
    "Storm solver": {
      label: `Next tight spot · ${homeData.nextStormLabel ?? "No date flagged"}`,
      detail: `${formatUSD(projectionLow.balanceCents)} projected low on day ${projectionLow.day}`,
    },

  };

  const features = [FEATURES[2], FEATURES[0], FEATURES[1]];

  return (
    <section
      aria-labelledby="feature-previews-title"
      className="h-full"
    >
          <h2 id="feature-previews-title" className="sr-only">
            Explore your tools
          </h2>
      <div className="grid h-full gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
        {features.map(({ title, description, href, icon: Icon, tag, tone }) => {
          const progress = progressByTitle[title];
          return (
            <Link
              key={title}
              href={href}
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
              <div className="mt-2 rounded-item bg-app px-3 py-2">
                <p className="text-caption font-medium wrap-break-word text-primary">{progress.label}</p>
                <p className="mt-0.5 text-micro wrap-break-word text-secondary">{progress.detail}</p>
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

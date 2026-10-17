"use client";

import { useSyncExternalStore } from "react";
import type { HomeData } from "./types";
import type { Goal, Scenario } from "@/features/big-purchase/types";
import type { CashBackData } from "@/features/cash-back/data/source";
import { goalStore } from "@/features/big-purchase/state/goalStore";
import { GoalsPreview } from "./GoalsPreview";
import { CashBackPreview } from "./CashBackPreview";
import { StormPreview } from "./StormPreview";

export function FeaturePreviews({ homeData, demoGoal, scenario }: { homeData: HomeData; cashBackData: CashBackData; demoGoal: Goal; scenario: Scenario }) {
  const storedGoal = useSyncExternalStore(goalStore.subscribe, goalStore.getSnapshot, goalStore.getServerSnapshot);
  const goal = storedGoal?.goals[0] ?? demoGoal;

  return (
    <section aria-labelledby="feature-previews-title" className="h-full">
      <h2 id="feature-previews-title" className="sr-only">Explore your tools</h2>
      <div className="grid h-full gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
        <StormPreview homeData={homeData} />
        <GoalsPreview goal={goal} scenario={scenario} />
        <CashBackPreview />
      </div>
    </section>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import type { HomeData } from "./types";
import type { Goal, Scenario } from "@/features/big-purchase/types";
import type { CashBackProfile } from "@/features/cash-back/data/source";
import { goalStore } from "@/features/big-purchase/state/goalStore";
import { useActiveCustomerId } from "@/components/layout/ActiveCustomer";
import { GoalsPreview } from "./GoalsPreview";
import { CashBackPreview } from "./CashBackPreview";
import { StormPreview } from "./StormPreview";

export function FeaturePreviews({ homeData, cashBack, scenario }: { homeData: HomeData; cashBack: CashBackProfile; scenario: Scenario }) {
  const customerId = useActiveCustomerId();
  const storedGoal = useSyncExternalStore(goalStore.subscribe, () => goalStore.getSnapshot(customerId), goalStore.getServerSnapshot);
  const goal: Goal | null = storedGoal?.goals[0] ?? null;

  return (
    <section aria-labelledby="feature-previews-title" className="h-full">
      <h2 id="feature-previews-title" className="sr-only">Explore your tools</h2>
      <div className="grid h-full gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
        <StormPreview homeData={homeData} scenario={scenario} />
        <GoalsPreview goal={goal} scenario={scenario} />
        <CashBackPreview profile={cashBack} />
      </div>
    </section>
  );
}

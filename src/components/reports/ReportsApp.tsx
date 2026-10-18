"use client";
import { useState, useSyncExternalStore } from "react";
import type { CustomerProfile } from "@/lib/nessie-profile";
import { resolveRange } from "@/lib/reports/dateRange";
import { DEFAULT_SECTIONS } from "@/lib/reports/sections";
import type { ReportConfig } from "@/lib/reports/types";
import { reportFromProfile } from "@/lib/reports/profileAdapter";
import { defaultCriticalBalanceCents } from "@/features/calendar/engine/balanceThresholds";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";
import { useReportGenerator } from "./useReportGenerator";
import { purchaseStore } from "@/features/calendar/state/purchaseStore";
import {
  prefsStore,
  resolvePrefs,
} from "@/features/cash-back/state/prefsStore";
import { goalStore } from "@/features/big-purchase/state/goalStore";
import { ReportPreview } from "./ReportPreview";
import { ReportOptionsPanel } from "./ReportOptionsPanel";
export function ReportsApp({ profile }: { profile: CustomerProfile }) {
  const [config, setConfig] = useState<ReportConfig>(() => ({
    preset: "last-month",
    range: resolveRange("last-month", profile.asOfDate),
    sections: { ...DEFAULT_SECTIONS },
    compareToPrevious: true,
  }));
  const criticalCents = useCriticalBalance(
    defaultCriticalBalanceCents(profile.scenario),
  );
  const storedGoals = useSyncExternalStore(
    goalStore.subscribe,
    () => goalStore.getSnapshot(profile.customer.id),
    goalStore.getServerSnapshot,
  );
  const purchases = useSyncExternalStore(
    purchaseStore.subscribe,
    () => purchaseStore.getSnapshot(profile.customer.id),
    purchaseStore.getServerSnapshot,
  );
  const savedCards = useSyncExternalStore(
    prefsStore.subscribe,
    () => prefsStore.getSnapshot(profile.customer.id),
    prefsStore.getServerSnapshot,
  );
  const local = {
    goals: storedGoals?.goals ?? [],
    purchases,
    cardIds: savedCards
      ? resolvePrefs(savedCards, profile.cashBack.ownedCardIds).ownedCardIds
      : profile.cashBack.ownedCardIds,
  };
  const generator = useReportGenerator(
    config,
    () => reportFromProfile(profile, config, criticalCents, local),
    JSON.stringify([profile, criticalCents, local]),
  );
  return (
    <div className="mx-auto max-w-350 px-5 py-8 md:px-8">
      <h1 className="page-title">Reports</h1>
      <p className="mb-7 mt-2 text-sm text-secondary">
        Your financial story, ready to take with you.
      </p>
      <p className="mb-5 text-xs text-secondary">
        Prepared for {profile.customer.name} · Nessie sandbox activity and
        labeled plan estimates · Dates use America/New_York.
      </p>
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <ReportOptionsPanel
          config={config}
          today={profile.asOfDate}
          onChange={setConfig}
          onGenerate={generator.generate}
          generating={generator.state.status === "generating"}
          stale={generator.stale}
          dataError={
            storedGoals === null || savedCards === null
              ? "Loading your saved plans…"
              : undefined
          }
        />
        <ReportPreview
          state={generator.state}
          stale={generator.stale}
          onRetry={generator.generate}
        />
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import type { CustomerProfile } from "@/lib/nessie-profile";
import { resolveRange } from "@/lib/reports/dateRange";
import { DEFAULT_SECTIONS } from "@/lib/reports/sections";
import type { ReportConfig } from "@/lib/reports/types";
import { reportFromProfile } from "@/lib/reports/profileAdapter";
import { defaultCriticalBalanceCents } from "@/features/calendar/engine/balanceThresholds";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";
import { useReportGenerator } from "./useReportGenerator";
import { ReportPreview } from "./ReportPreview";
import { ReportOptionsPanel } from "./ReportOptionsPanel";
export function ReportsApp({ profile }: { profile: CustomerProfile }) {
  const [config, setConfig] = useState<ReportConfig>(() => ({ preset: "last-month", range: resolveRange("last-month", profile.asOfDate), sections: { ...DEFAULT_SECTIONS }, compareToPrevious: true }));
  const criticalCents = useCriticalBalance(defaultCriticalBalanceCents(profile.scenario));
  const generator = useReportGenerator(config, () => reportFromProfile(profile, config, criticalCents), String(criticalCents));
  return <div className="mx-auto max-w-350 px-5 py-8 md:px-8"><h1 className="page-title">Reports</h1><p className="mb-7 mt-2 text-sm text-secondary">Your financial story, ready to take with you.</p><div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"><ReportOptionsPanel config={config} today={profile.asOfDate} onChange={setConfig} onGenerate={generator.generate} generating={generator.state.status === "generating"} stale={generator.stale} /><ReportPreview state={generator.state} stale={generator.stale} onRetry={generator.generate} /></div></div>;
}

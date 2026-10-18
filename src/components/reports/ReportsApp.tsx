"use client";
import { useState } from "react";
import type { CustomerProfile } from "@/lib/nessie-profile";
import { resolveRange } from "@/lib/reports/dateRange";
import { DEFAULT_SECTIONS } from "@/lib/reports/sections";
import type { ReportConfig } from "@/lib/reports/types";
import { ReportOptionsPanel } from "./ReportOptionsPanel";
export function ReportsApp({ profile }: { profile: CustomerProfile }) {
  const [config, setConfig] = useState<ReportConfig>(() => ({ preset: "last-month", range: resolveRange("last-month", profile.asOfDate), sections: { ...DEFAULT_SECTIONS }, compareToPrevious: true }));
  return <div className="mx-auto max-w-350 px-5 py-8 md:px-8"><h1 className="page-title">Reports</h1><p className="mb-7 mt-2 text-sm text-secondary">Your financial story, ready to take with you.</p><div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"><ReportOptionsPanel config={config} today={profile.asOfDate} onChange={setConfig} onGenerate={() => {}} dataError="PDF generation is being connected." /><div className="rounded-xl border border-border bg-card p-8">Choose a range and sections, then generate your report.</div></div></div>;
}

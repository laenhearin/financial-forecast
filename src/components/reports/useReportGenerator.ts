"use client";
import { useEffect, useRef, useState } from "react";
import type { ReportConfig, ReportData } from "@/lib/reports/types";
import { requestSummary } from "@/lib/reports/summary";
export type GenerationState = {
  status: "idle" | "generating" | "ready" | "error";
  progress?: string;
  error?: string;
  url?: string;
  filename?: string;
  configKey?: string;
};
export function useReportGenerator(
  config: ReportConfig,
  build: () => ReportData,
  sourceKey = "",
) {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const request = useRef(0);
  const objectUrl = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const key = JSON.stringify([config, sourceKey]);
  useEffect(
    () => () => {
      request.current++;
      controller.current?.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  async function generate() {
    if (busy.current) return;
    busy.current = true;
    const id = ++request.current;
    controller.current?.abort();
    controller.current = new AbortController();
    const configKey = key;
    setState((previous) => ({
      ...previous,
      status: "generating",
      progress: "Gathering your data…",
      error: undefined,
    }));
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const data = build();
      if (request.current !== id) return;
      if (data.summaryStats) {
        setState((previous) => ({
          ...previous,
          progress: "Writing your summary…",
        }));
        data.summary = await requestSummary(
          data.summaryStats,
          controller.current.signal,
        );
      }
      if (request.current !== id) return;
      setState((previous) => ({ ...previous, progress: "Building your PDF…" }));
      const { renderReport } = await import("./pdf/renderReport");
      const blob = await renderReport(data);
      if (request.current !== id) return;
      const url = URL.createObjectURL(blob);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      setState({
        status: "ready",
        url,
        filename: `report-${config.range.start}_to_${config.range.end}.pdf`,
        configKey,
      });
    } catch {
      if (request.current === id)
        setState((previous) => ({
          ...previous,
          status: "error",
          error: "We couldn't build your PDF. Try again.",
        }));
    } finally {
      busy.current = false;
    }
  }
  return {
    state,
    stale: Boolean(state.url && state.configKey !== key),
    generate,
  };
}

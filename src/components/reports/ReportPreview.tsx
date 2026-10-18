"use client";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenerationState } from "./useReportGenerator";
export function ReportPreview({
  state,
  stale,
  onRetry,
}: {
  state: GenerationState;
  stale: boolean;
  onRetry: () => void;
}) {
  return (
    <section
      aria-label="Report preview"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      {stale && (
        <p
          role="status"
          className="border-b border-border bg-muted p-4 text-sm"
        >
          Settings changed. Regenerate to update the preview.
        </p>
      )}
      {state.status === "generating" && (
        <div role="status" className="flex items-center gap-3 p-5 text-sm">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          {state.progress}
        </div>
      )}
      {state.status === "error" && (
        <div role="alert" className="space-y-3 p-5">
          <p className="text-sm text-neg">{state.error}</p>
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
      {state.url ? (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <p className="text-sm font-medium">Your report is ready</p>
            <a
              href={state.url}
              download={state.filename}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              <Download className="size-4" aria-hidden />
              Download PDF
            </a>
          </div>
          <iframe
            title="Financial report PDF preview"
            src={state.url}
            className="h-[760px] w-full border-0 bg-muted"
          />
          <p className="p-3 text-xs text-muted-foreground">
            If your browser cannot preview PDFs, use Download PDF to open it.
          </p>
        </>
      ) : state.status === "idle" ? (
        <div className="flex min-h-110 flex-col items-center justify-center gap-5 p-8 text-center">
          <span className="rounded-2xl bg-muted p-5">
            <FileText
              className="size-10 text-secondary"
              strokeWidth={1.3}
              aria-hidden
            />
          </span>
          <p className="max-w-70 text-sm text-secondary">
            Choose a range and sections, then generate your report.
          </p>
        </div>
      ) : (
        <div className="min-h-80 animate-pulse bg-muted/40" />
      )}
    </section>
  );
}

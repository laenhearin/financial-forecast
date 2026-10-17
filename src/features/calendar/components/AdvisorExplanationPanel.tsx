import { Sparkles } from "lucide-react";
import type { AdvisorExplanationState } from "../state/useAdvisorExplanation";

/** Plain-language explanation under the verdict. The numbers above it come from the engine. */
export function AdvisorExplanationPanel({ state }: { state: AdvisorExplanationState }) {
  if (state.status === "idle") return null;
  const fromModel = state.status === "ready" && state.source !== "template";
  return (
    <div aria-live="polite" aria-busy={state.status === "loading"} className="mt-3 rounded-item border border-app bg-card px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-micro font-semibold text-secondary">
        <Sparkles aria-hidden className="size-3.5 text-accent" strokeWidth={1.75} />
        {state.status === "loading" ? "Explaining…" : fromModel ? "AI explanation" : "Explanation"}
      </p>
      {state.status === "loading" ? (
        <div className="mt-2 space-y-2">
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
          <div className="h-3.5 w-full animate-pulse rounded bg-secondary motion-reduce:animate-none" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-caption font-semibold text-primary">{state.explanation.headline}</p>
          <p className="mt-1 text-caption text-primary">{state.explanation.explanation}</p>
          {state.explanation.alternative && <p className="mt-1.5 text-caption text-secondary">{state.explanation.alternative}</p>}
          <p className="mt-2 text-micro text-secondary">
            {fromModel ? "Written by AI from the forecast numbers above." : "From a template, using the forecast numbers above."}
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { stableStringify } from "@/lib/ai/promptJson";
import type { AdvisorExplanation, AdvisorResponse, AiSource, PurchaseInput } from "@/lib/ai/types";
import type { UserPurchase } from "../types";

/** Wait for typing to settle before asking the model, so a typed amount costs one request. */
const EXPLAIN_DEBOUNCE_MS = 900;

export type AdvisorExplanationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; explanation: AdvisorExplanation; source: AiSource };

/**
 * The AI explanation under the Advisor's verdict. The verdict itself never waits for this: the
 * engine renders it immediately and this fills in below. Any failure shows `localTemplate()`,
 * built in the browser from the same engine facts, so the panel is never empty.
 */
export function useAdvisorExplanation(
  purchase: PurchaseInput | null,
  criticalBalanceCents: number,
  purchases: readonly UserPurchase[],
  localTemplate: () => AdvisorExplanation | null,
): AdvisorExplanationState {
  const key = purchase ? stableStringify({ purchase, criticalBalanceCents, purchases }) : null;
  const [result, setResult] = useState<{ key: string; explanation: AdvisorExplanation; source: AiSource } | null>(null);
  const templateRef = useRef(localTemplate);
  useEffect(() => { templateRef.current = localTemplate; });

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/ai/advisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: controller.signal });
        if (!response.ok) throw new Error(`Advisor explanation failed (${response.status}).`);
        const body = await response.json() as Partial<AdvisorResponse>;
        if (!body.explanation || !body.meta) throw new Error("Advisor explanation was empty.");
        setResult({ key, explanation: body.explanation, source: body.meta.source });
      } catch {
        if (controller.signal.aborted) return;
        const explanation = templateRef.current();
        if (explanation) setResult({ key, explanation, source: "template" });
      }
    }, EXPLAIN_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  if (!key) return { status: "idle" };
  return result?.key === key ? { status: "ready", explanation: result.explanation, source: result.source } : { status: "loading" };
}

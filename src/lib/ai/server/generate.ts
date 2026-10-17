import "server-only";
import { auditNumbers } from "../audit";
import type { AiFallbackReason, AiMeta, AiSurface } from "../types";
import { cacheKey } from "./cache";
import { normalizeLlmError, type ThinkingLevel } from "./client";
import { templateOnlyReason } from "./config";
import { retryDelayMs, timeoutSignal, type AiRuntime } from "./runtime";

/** One structured-output surface. Adding a surface means a new spec, not new policy code. */
export interface StructuredSpec<T> {
  surface: AiSurface;
  tier: "main" | "fast";
  system: string;
  /** Prompt payload, in dollars. Sent as data after "FACTS:" and used as the audit's allowed set. */
  facts: unknown;
  schema: Record<string, unknown>;
  /** Returns the cleaned value, or null when the model output is unusable. */
  validate: (data: unknown) => T | null;
  /** Deterministic text built from the same facts. */
  template: () => T;
  /** Text to audit for dollar amounts; omit to skip the audit. */
  auditText?: (value: T) => string;
  maxOutputTokens?: number;
  temperature?: number;
  thinking?: ThinkingLevel;
}

export interface Generated<T> { value: T; meta: AiMeta }

const RETRYABLE = new Set<AiFallbackReason>(["rate_limited", "unavailable", "bad_output"]);

/**
 * The shared policy: templates when AI is off, then cache, then the tier's model, then one retry
 * (fallback model, or the same model after a short delay), then the template. Never throws.
 */
export async function generateStructured<T>(spec: StructuredSpec<T>, runtime: AiRuntime, signal?: AbortSignal): Promise<Generated<T>> {
  const started = runtime.now();
  const elapsed = () => Math.round(runtime.now() - started);
  const template = (fallbackReason: AiFallbackReason, auditFlags?: string[]): Generated<T> => ({
    value: spec.template(),
    meta: { source: "template", latencyMs: elapsed(), fallbackReason, ...(auditFlags ? { auditFlags } : {}) },
  });

  const off = templateOnlyReason(runtime.config);
  if (off || !runtime.client) return template(off ?? "no-key");

  const primary = runtime.config.models[spec.tier];
  const key = cacheKey(spec.surface, primary, spec.facts);
  const hit = runtime.cache.get(key) as { value: T; model: string } | undefined;
  if (hit) return { value: hit.value, meta: { source: "cache", model: hit.model, latencyMs: elapsed() } };

  const fallback = runtime.config.models.fallback;
  const attempts = [primary, fallback !== primary ? fallback : primary];
  const id = runtime.requestId();
  let reason: AiFallbackReason = "other";

  for (const [index, model] of attempts.entries()) {
    if (index > 0 && model === attempts[index - 1]) await runtime.sleep(retryDelayMs());
    let data: unknown;
    try {
      ({ data } = await runtime.client.generateJson({
        model,
        system: spec.system,
        user: `FACTS:\n${JSON.stringify(spec.facts)}`,
        schema: spec.schema,
        maxOutputTokens: spec.maxOutputTokens,
        temperature: spec.temperature,
        thinking: spec.thinking,
        signal: timeoutSignal(runtime.config.timeoutMs, signal),
      }));
    } catch (error) {
      const failure = normalizeLlmError(error, signal);
      reason = failure.kind;
      logFailure(id, spec.surface, model, failure);
      if (RETRYABLE.has(failure.kind)) continue;
      break;
    }
    const value = spec.validate(data);
    if (value === null) {
      reason = "bad_output";
      logFailure(id, spec.surface, model, { kind: "bad_output" });
      continue;
    }
    if (spec.auditText) {
      const audit = auditNumbers(spec.auditText(value), [spec.facts]);
      if (!audit.ok) {
        console.warn(`[ai ${id}] ${spec.surface} audit failed on ${model}: ${audit.flags.join("; ")}`);
        return template("audit", audit.flags);
      }
    }
    runtime.cache.set(key, { value, model });
    return { value, meta: { source: "model", model, latencyMs: elapsed() } };
  }
  return template(reason);
}

/** Server log line for a failed call. `detail` is Google's short reason; never the key or prompt. */
export function logFailure(id: string, surface: string, model: string, failure: { kind: string; status?: number; detail?: string }): void {
  const reason = failure.detail ? ` Google says: "${failure.detail}"` : "";
  if (failure.kind === "auth") console.error(`[ai ${id}] Gemini rejected the API key for ${surface} (${model}). Check GEMINI_API_KEY.${reason}`);
  else if (failure.kind === "billing") console.error(`[ai ${id}] Gemini billing problem for ${surface} (${model}); every model on this key will fail until it is fixed in AI Studio.${reason}`);
  else console.warn(`[ai ${id}] ${surface} on ${model} failed: ${failure.kind}${failure.status ? ` (${failure.status})` : ""}.${reason}`);
}

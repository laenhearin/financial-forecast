import "server-only";
import type { AiFallbackReason } from "../types";

/** Typed AI settings. The only module that reads the AI environment variables. */
export interface AiConfig {
  /** Server only. Never logged, never returned to the browser. */
  apiKey: string | null;
  enabled: boolean;
  forceFallback: boolean;
  models: { main: string; fast: string; fallback: string };
  timeoutMs: number;
  cacheTtlMs: number;
  cacheMaxEntries: number;
  routeRateLimitPerMin: number;
}

export const DEFAULT_MODELS = {
  main: "gemini-3.8-flash",
  fast: "gemini-3.5-flash-lite",
  fallback: "gemini-3.5-flash-lite",
} as const;

type Env = Record<string, string | undefined>;

export function readAiConfig(env: Env = process.env): AiConfig {
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || null,
    enabled: flag(env.AI_ENABLED, true),
    forceFallback: flag(env.AI_FORCE_FALLBACK, false),
    models: {
      main: env.GEMINI_MODEL_MAIN?.trim() || DEFAULT_MODELS.main,
      fast: env.GEMINI_MODEL_FAST?.trim() || DEFAULT_MODELS.fast,
      fallback: env.GEMINI_MODEL_FALLBACK?.trim() || DEFAULT_MODELS.fallback,
    },
    timeoutMs: positiveInt(env.AI_REQUEST_TIMEOUT_MS, 15_000),
    cacheTtlMs: positiveInt(env.AI_CACHE_TTL_MS, 600_000),
    cacheMaxEntries: positiveInt(env.AI_CACHE_MAX_ENTRIES, 200),
    routeRateLimitPerMin: positiveInt(env.AI_ROUTE_RATE_LIMIT_PER_MIN, 30),
  };
}

/** Why the model will not be called, or null when it may be. A missing key never throws. */
export function templateOnlyReason(config: AiConfig): AiFallbackReason | null {
  if (!config.enabled) return "disabled";
  if (config.forceFallback) return "forced";
  if (!config.apiKey) return "no-key";
  return null;
}

let warnedNoKey = false;
/** Logs once when AI is on but no key is set, so the template mode is not a silent surprise. */
export function warnIfNoKey(config: AiConfig): void {
  if (warnedNoKey || !config.enabled || config.forceFallback || config.apiKey) return;
  warnedNoKey = true;
  console.warn("[ai] GEMINI_API_KEY is not set; AI surfaces will use template text.");
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

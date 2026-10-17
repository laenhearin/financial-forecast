import "server-only";
import { randomUUID } from "node:crypto";
import { TtlLruCache } from "./cache";
import { createGeminiClient, type LlmClient } from "./client";
import { readAiConfig, templateOnlyReason, warnIfNoKey, type AiConfig } from "./config";
import { TokenBucketLimiter } from "./ratelimit";

/** Everything a surface needs to run. Routes use the shared runtime; tests build their own. */
export interface AiRuntime {
  config: AiConfig;
  /** Null when the model must not be called (disabled, forced fallback, or no key). */
  client: LlmClient | null;
  cache: TtlLruCache<unknown>;
  limiter: TokenBucketLimiter;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  requestId: () => string;
}

let shared: AiRuntime | null = null;

export function getAiRuntime(): AiRuntime {
  if (shared) return shared;
  const config = readAiConfig();
  warnIfNoKey(config);
  shared = {
    config,
    client: templateOnlyReason(config) === null && config.apiKey ? createGeminiClient(config.apiKey) : null,
    cache: new TtlLruCache(config.cacheMaxEntries, config.cacheTtlMs),
    limiter: new TokenBucketLimiter(config.routeRateLimitPerMin),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => performance.now(),
    requestId: () => randomUUID().slice(0, 8),
  };
  return shared;
}

/** Bounds a model call by the configured timeout and, when given, the incoming request's signal. */
export function timeoutSignal(timeoutMs: number, parent?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([timeout, parent]) : timeout;
}

/** Same-model retry delay: about 800 ms with jitter. */
export function retryDelayMs(): number {
  return 800 + Math.floor(Math.random() * 400);
}

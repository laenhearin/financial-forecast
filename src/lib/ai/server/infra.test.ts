import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cacheKey, TtlLruCache } from "./cache";
import { DEFAULT_MODELS, readAiConfig, templateOnlyReason } from "./config";
import { clientKeyFor, TokenBucketLimiter } from "./ratelimit";

describe("readAiConfig", () => {
  it("falls back to templates without a key, and never throws", () => {
    const config = readAiConfig({});
    expect(config.apiKey).toBeNull();
    expect(templateOnlyReason(config)).toBe("no-key");
    expect(config.models).toEqual(DEFAULT_MODELS);
  });

  it("reads switches, overrides and limits", () => {
    const config = readAiConfig({
      GEMINI_API_KEY: " key ", GEMINI_MODEL_MAIN: "m1", GEMINI_MODEL_FAST: "f1", GEMINI_MODEL_FALLBACK: "fb",
      AI_REQUEST_TIMEOUT_MS: "5000", AI_ROUTE_RATE_LIMIT_PER_MIN: "nope",
    });
    expect(config.apiKey).toBe("key");
    expect(config.models).toEqual({ main: "m1", fast: "f1", fallback: "fb" });
    expect(config.timeoutMs).toBe(5000);
    expect(config.routeRateLimitPerMin).toBe(30);
    expect(templateOnlyReason(config)).toBeNull();
    expect(templateOnlyReason(readAiConfig({ GEMINI_API_KEY: "k", AI_FORCE_FALLBACK: "true" }))).toBe("forced");
    expect(templateOnlyReason(readAiConfig({ GEMINI_API_KEY: "k", AI_ENABLED: "false" }))).toBe("disabled");
  });
});

describe("TtlLruCache", () => {
  it("hits, expires and evicts the least recently used entry", () => {
    let now = 0;
    const cache = new TtlLruCache<string>(2, 100, () => now);
    cache.set("a", "A");
    cache.set("b", "B");
    expect(cache.get("a")).toBe("A"); // a is now most recent
    cache.set("c", "C");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
    now = 150;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("builds the same key regardless of key order and question spacing", () => {
    expect(cacheKey("ask", "m", { a: 1, b: { c: 2 } }, "Can I  afford it? ")).toBe(cacheKey("ask", "m", { b: { c: 2 }, a: 1 }, "can i afford it?"));
    expect(cacheKey("ask", "m", { a: 1 })).not.toBe(cacheKey("ask", "other", { a: 1 }));
    expect(cacheKey("ask", "m", { a: 1 })).not.toBe(cacheKey("advisor", "m", { a: 1 }));
  });
});

describe("TokenBucketLimiter", () => {
  it("allows up to the limit, rejects beyond it, and refills over time", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter(3, () => now);
    expect([limiter.take("ip"), limiter.take("ip"), limiter.take("ip"), limiter.take("ip")]).toEqual([true, true, true, false]);
    expect(limiter.take("other")).toBe(true);
    now = 20_000; // a third of a minute refills one token
    expect(limiter.take("ip")).toBe(true);
    expect(limiter.take("ip")).toBe(false);
  });

  it("keys clients by forwarded address, then real IP, then one shared bucket", () => {
    expect(clientKeyFor(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientKeyFor(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } }))).toBe("5.6.7.8");
    expect(clientKeyFor(new Request("http://x"))).toBe("global");
  });
});

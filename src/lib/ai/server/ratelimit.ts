import "server-only";

/**
 * Per-client token bucket for our own AI routes, so a runaway browser loop can't drain the shared
 * free-tier quota. In memory and per instance, like the cache.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();

  constructor(
    private readonly perMinute: number,
    private readonly now: () => number = Date.now,
    private readonly maxClients = 5_000,
  ) {}

  /** Takes one token for the client; false when the bucket is empty. */
  take(clientKey: string): boolean {
    const now = this.now();
    const bucket = this.buckets.get(clientKey) ?? { tokens: this.perMinute, updatedAt: now };
    const refill = ((now - bucket.updatedAt) / 60_000) * this.perMinute;
    bucket.tokens = Math.min(this.perMinute, bucket.tokens + refill);
    bucket.updatedAt = now;
    this.buckets.delete(clientKey);
    if (this.buckets.size >= this.maxClients) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
    this.buckets.set(clientKey, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }
}

/** First forwarded address, else the platform's real-IP header, else one shared bucket. */
export function clientKeyFor(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "global";
}

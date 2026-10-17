import "server-only";
import { createHash } from "node:crypto";
import { stableStringify } from "../promptJson";

/**
 * In-memory LRU cache with a TTL, for model answers only (templates are never cached).
 * On Vercel each serverless instance has its own memory, so this is best-effort: repeated demo
 * clicks usually hit, but a cold instance starts empty. That is acceptable for the hackathon.
 */
export class TtlLruCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so the Map's order tracks recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number { return this.entries.size; }
}

/** sha256 of the surface, model, facts (key order ignored) and the normalized question. */
export function cacheKey(surface: string, model: string, facts: unknown, question = ""): string {
  const normalized = question.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(`${surface}\n${model}\n${stableStringify(facts)}\n${normalized}`).digest("hex");
}

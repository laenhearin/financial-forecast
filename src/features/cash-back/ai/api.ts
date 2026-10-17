import { MAX_AI_MERCHANTS, MAX_MERCHANT_LENGTH } from "../config";
import { isCategory, type Category } from "../types";

/** Response shapes shared by the AI routes and the browser. */
export type CategorizeResponse =
  | { status: "ok"; categories: Record<string, Category> }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export type AdviceResponse =
  | { status: "ai"; text: string }
  | { status: "template"; text: string; message: string }
  | { status: "error"; text: string; message: string };

/** Accepts { merchants: string[] } with bounded size; returns trimmed, de-duplicated names or null. */
export function parseMerchantList(value: unknown): string[] | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const merchants = (value as { merchants?: unknown }).merchants;
  if (!Array.isArray(merchants) || merchants.length === 0 || merchants.length > MAX_AI_MERCHANTS) return null;
  const clean: string[] = [];
  for (const merchant of merchants) {
    if (typeof merchant !== "string") return null;
    const trimmed = merchant.trim();
    if (!trimmed || trimmed.length > MAX_MERCHANT_LENGTH) return null;
    if (!clean.includes(trimmed)) clean.push(trimmed);
  }
  return clean;
}

/**
 * Keeps only results for merchants that were asked about, with a known category.
 * Model output is untrusted, so anything else is dropped.
 */
export function sanitizeClassifications(requested: readonly string[], results: unknown): Record<string, Category> {
  // No prototype, so a merchant named "__proto__" or "constructor" is just a key.
  const out: Record<string, Category> = Object.create(null);
  if (!Array.isArray(results)) return out;
  const wanted = new Set(requested);
  for (const item of results) {
    if (typeof item !== "object" || item === null) continue;
    const { merchant, category } = item as { merchant?: unknown; category?: unknown };
    if (typeof merchant !== "string" || !wanted.has(merchant)) continue;
    if (!isCategory(category)) continue;
    out[merchant] = category;
  }
  return out;
}

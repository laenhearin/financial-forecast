/** Pure helpers for the JSON the model sees. Client and server safe. */

/** JSON with object keys sorted, so equal facts always produce the same text (and cache key). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/**
 * The app keeps money in integer cents; the model reads dollars. Every key ending in "Cents" becomes
 * the same key without the suffix, and a bare "cents" key becomes "amount", divided by 100 (exact to
 * two decimals). Nothing else changes.
 */
export function toPromptFacts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toPromptFacts);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key === "cents" && typeof inner === "number") out.amount = inner / 100;
      else if (key.endsWith("Cents") && key.length > 5 && typeof inner === "number") out[key.slice(0, -5)] = inner / 100;
      else out[key] = toPromptFacts(inner);
    }
    return out;
  }
  return value;
}

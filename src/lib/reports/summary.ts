import { isISODate } from "../dates";
import { buildFallbackSummary } from "./fallbackSummary";
import { safeLabel } from "./masking";
import type { SummaryStats } from "./types";
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function keys(value: Record<string, unknown>, allowed: string[]) { return Object.keys(value).every(key => allowed.includes(key)); }
function money(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000_000_000; }
function label(value: unknown, max = 120): value is string { return typeof value === "string" && value.length > 0 && value.length <= max && safeLabel(value) === value && !/[\r\n]/.test(value); }
function totals(value: unknown): value is SummaryStats["totals"] {
  return record(value) && keys(value, ["incomeCents", "spendingCents", "netCents"]) && money(value.incomeCents) && value.incomeCents >= 0 && money(value.spendingCents) && value.spendingCents >= 0 && money(value.netCents) && value.netCents === value.incomeCents - value.spendingCents;
}
/** Explicit aggregate allow-list; reject extra fields rather than forwarding client objects. */
export function parseSummaryStats(value: unknown): SummaryStats | null {
  if (!record(value) || !keys(value, ["rangeLabel", "totals", "previous", "topCategories", "forecast"]) || (typeof value.rangeLabel !== "string" || !/^[A-Z][a-z]{2} \d{1,2} \d{4} to [A-Z][a-z]{2} \d{1,2} \d{4}$/.test(value.rangeLabel)) || !totals(value.totals) || (value.previous !== undefined && !totals(value.previous))) return null;
  if (!Array.isArray(value.topCategories) || value.topCategories.length > 5 || !value.topCategories.every(item => record(item) && keys(item, ["category", "amountCents"]) && label(item.category, 80) && money(item.amountCents) && item.amountCents >= 0)) return null;
  if (value.forecast !== undefined) {
    const f = value.forecast;
    if (!record(f) || !keys(f, ["lowestBalanceCents", "lowestBalanceDate", "worstWeather", "stormDays"]) || !money(f.lowestBalanceCents) || typeof f.lowestBalanceDate !== "string" || !isISODate(f.lowestBalanceDate) || !label(f.worstWeather, 30) || typeof f.stormDays !== "number" || !Number.isInteger(f.stormDays) || f.stormDays < 0 || f.stormDays > 31) return null;
  }
  return value as unknown as SummaryStats;
}
export function cleanSummary(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1400) return null;
  const cleaned = value.replace(/[`*_#>]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 && cleaned.length <= 900 ? cleaned : null;
}
/** An AI failure cannot block export. Race also bounds a stalled response body. */
export async function requestSummary(stats: SummaryStats, parent: AbortSignal): Promise<{ text: string; source: "ai" | "fallback" }> {
  const fallback = () => ({ text: buildFallbackSummary(stats), source: "fallback" as const });
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener("abort", abort, { once: true });
  if (parent.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch("/api/reports/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stats), signal: controller.signal });
        if (!response.ok) return fallback();
        const body: unknown = await response.json();
        if (!record(body)) return fallback();
        const text = cleanSummary(body.text);
        if (!text || (body.source !== undefined && body.source !== "ai" && body.source !== "fallback")) return fallback();
        return { text, source: body.source === "fallback" ? "fallback" as const : "ai" as const };
      })(),
      new Promise<ReturnType<typeof fallback>>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(fallback()); }, 8000); }),
    ]);
  } catch { return fallback(); }
  finally { clearTimeout(timer); parent.removeEventListener("abort", abort); }
}

import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fakeClient, testRuntime } from "@/lib/ai/server/testing";
import { handleReportSummary } from "../summaryHandler";
import { cleanSummary, requestSummary } from "../summary";
import type { SummaryStats } from "../types";
const stats: SummaryStats = { rangeLabel: "Sep 1 2026 to Sep 30 2026", totals: { incomeCents: 10000, spendingCents: 3000, netCents: 7000 }, topCategories: [{ category: "Dining", amountCents: 3000 }] };
const post = (body: unknown) => new Request("http://localhost/api/reports/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("rejects raw fields, malformed aggregates and oversized payloads", async () => {
  const runtime = testRuntime(null);
  for (const body of [{}, { ...stats, transactions: [] }, { ...stats, totals: { ...stats.totals, netCents: 0 } }, { ...stats, topCategories: [{ category: "1234567890", amountCents: 3 }] }]) expect((await handleReportSummary(post(body), runtime)).status).toBe(400);
  expect((await handleReportSummary(post({ text: "x".repeat(5000) }), runtime)).status).toBe(413);
});
it("uses the existing LLM runtime and passes dollar aggregates only", async () => {
  const { client, jsonCalls } = fakeClient({ json: [() => ({ text: "You received $100 and spent $30. Your net was $70. Dining was your largest category." })] });
  const response = await handleReportSummary(post(stats), testRuntime(client));
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ source: "ai", text: expect.stringContaining("$70") });
  const facts = JSON.parse(jsonCalls[0].user.replace(/^FACTS:\n/, ""));
  expect(facts.totals.income).toBe(100); expect(facts.transactions).toBeUndefined();
});
it("returns a labeled fallback when the model fails or invents money", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const client of [null, fakeClient({ json: [() => ({ text: "You saved $999." })] }).client]) {
    const body = await (await handleReportSummary(post(stats), testRuntime(client))).json();
    expect(body.source).toBe("fallback"); expect(body.text).not.toContain("$999");
  }
});
it("bounds output and strips markdown", () => {
  expect(cleanSummary(" **You** saved.\nReview it. ")).toBe("You saved. Review it.");
  expect(cleanSummary(" ")).toBeNull(); expect(cleanSummary("x".repeat(901))).toBeNull();
});
it("falls back on HTTP failures, invalid JSON output, and the eight-second timeout", async () => {
  for (const response of [new Response("error", { status: 500 }), Response.json({ text: "" }), new Response("not json")]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    expect((await requestSummary(stats, new AbortController().signal)).source).toBe("fallback");
  }
  vi.useFakeTimers(); let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url, init) => { signal = init.signal; return new Promise(() => {}); }));
  const pending = requestSummary(stats, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(8000);
  expect((await pending).source).toBe("fallback"); expect(signal?.aborted).toBe(true);
});

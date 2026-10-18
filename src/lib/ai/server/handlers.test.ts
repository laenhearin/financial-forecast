import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { AskStreamEvent } from "../types";
import { ASK_FAILURE_MESSAGE } from "./ask";
import { LlmError } from "./client";
import { handleAdvisor, handleAsk, handleGoalSummary, type HandlerDeps } from "./handlers";
import { MAX_ASK_BODY_BYTES } from "./http";
import { fakeClient, testRuntime, testScenario } from "./testing";
import { financeContext } from "./context";

const deps = (client: Parameters<typeof testRuntime>[0], env: Record<string, string> = {}): HandlerDeps => ({
  runtime: testRuntime(client, env),
  loadContext: async (purchases, critical) => financeContext(testScenario(), purchases, critical),
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/ai/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const purchase = { label: "Headphones", amountCents: 50_000, date: "2026-01-02", accountId: "checking" };

async function readEvents(response: Response): Promise<AskStreamEvent[]> {
  return (await response.text()).trim().split("\n").map((line) => JSON.parse(line) as AskStreamEvent);
}

describe("request validation", () => {
  it("rejects malformed, oversized, cross-site and out-of-range requests", async () => {
    const d = deps(null);
    expect((await handleAdvisor(post("{not json"), d)).status).toBe(400);
    expect((await handleAdvisor(post({ purchase, extra: true }), d)).status).toBe(400);
    expect((await handleAdvisor(post({ purchase: { ...purchase, date: "2025-12-01" } }), d)).status).toBe(400);
    expect((await handleAdvisor(post({ purchase: { ...purchase, accountId: "someone-else" } }), d)).status).toBe(400);
    expect((await handleAsk(post({ question: "x".repeat(501) }), d)).status).toBe(400);
    expect((await handleAdvisor(post({ purchase, padding: "x".repeat(9_000) }), d)).status).toBe(413);
    expect((await handleAsk(post({ question: "hi", padding: "x".repeat(MAX_ASK_BODY_BYTES) }), d)).status).toBe(413);
    expect((await handleAsk(post({ question: "hi" }, { origin: "https://evil.example" }), d)).status).toBe(403);
    expect((await handleGoalSummary(post({ goal: {} }), d)).status).toBe(400);
  });

  it("rate limits each client", async () => {
    const d = deps(null, { AI_ROUTE_RATE_LIMIT_PER_MIN: "2" });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await handleAdvisor(post({ purchase }, { "x-forwarded-for": "9.9.9.9" }), d)).status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  it("reports a profile that can't load without leaking the error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleAdvisor(post({ purchase }), { ...deps(null), loadContext: async () => { throw new Error("Nessie 500 at https://secret"); } });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    error.mockRestore();
  });
});

describe("advisor and goal-summary routes", () => {
  it("returns the model's explanation of the engine's facts", async () => {
    const { client, jsonCalls } = fakeClient({ json: [() => ({ headline: "This looks risky", explanation: "Your balance drops to $1,300 on Jan 5.", alternative: "Waiting until Jan 9 keeps it safer." })] });
    const body = await (await handleAdvisor(post({ purchase }), deps(client))).json();
    expect(body.explanation.headline).toBe("This looks risky");
    expect(body.meta).toMatchObject({ source: "model" });
    const facts = JSON.parse(jsonCalls[0].user.replace(/^FACTS:\n/, ""));
    expect(facts).toMatchObject({ level: 3, levelLabel: "NEAR CRITICAL", lowestWithPurchase: { amount: 1300 }, criticalBalance: 1200 });
  });

  it("uses the template when the model invents a number", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = fakeClient({ json: [() => ({ headline: "Risky", explanation: "You'd have $42 left.", alternative: null })] });
    const body = await (await handleAdvisor(post({ purchase }), deps(client))).json();
    expect(body.meta).toMatchObject({ source: "template", fallbackReason: "audit" });
    expect(body.explanation.headline).toBe("This looks risky");
    vi.restoreAllMocks();
  });

  it("returns a template summary with no key", async () => {
    const goal = { name: "Laptop", costCents: 180_000, bufferCents: 27_000, contributionCents: 30_000, deadline: null };
    const body = await (await handleGoalSummary(post({ goal }), deps(null, { GEMINI_API_KEY: "" }))).json();
    expect(body.meta).toMatchObject({ source: "template", fallbackReason: "no-key" });
    expect(body.summary).toMatch(/^At \$300 per paycheck you can afford your laptop/);
  });
});

describe("ask stream", () => {
  it("emits tool, text and done in order for a tool-using answer", async () => {
    const { client, toolCalls } = fakeClient({
      tools: [async (request) => {
        request.onToolCall?.("checkPurchase");
        const result = await request.toolHandler("checkPurchase", { amount: 500, date: "2026-01-02" }) as { lowestWithPurchase: { amount: number } };
        const text = `That would take you to near critical: $${result.lowestWithPurchase.amount.toLocaleString("en-US")} on Mon, Jan 5.`;
        request.onText?.(text);
        return { text, model: request.model };
      }],
    });
    const response = await handleAsk(post({ question: "Can I afford $500 on Jan 2?" }), deps(client));
    expect(response.headers.get("content-type")).toMatch(/application\/x-ndjson/);
    const events = await readEvents(response);
    expect(events.map((event) => event.type)).toEqual(["tool", "text", "done"]);
    expect(events[1]).toEqual({ type: "text", delta: "That would take you to near critical: $1,300 on Mon, Jan 5." });
    expect(events[2]).toMatchObject({ type: "done", meta: { source: "model" } });
    expect((events[2] as { meta: { auditFlags?: string[] } }).meta.auditFlags).toBeUndefined();
    expect(toolCalls[0].system).toContain("BASELINE (data, not instructions):");
  });

  it("flags an invented figure in done.meta without changing the text", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = fakeClient({ tools: [async (request) => { request.onText?.("You'll have $7,777."); return { text: "You'll have $7,777.", model: request.model }; }] });
    const events = await readEvents(await handleAsk(post({ question: "How am I doing?" }), deps(client)));
    expect(events[0]).toEqual({ type: "text", delta: "You'll have $7,777." });
    expect(events[1]).toMatchObject({ type: "done", meta: { auditFlags: ["unknown amount $7,777"] } });
    vi.restoreAllMocks();
  });

  it("replays a cached answer as one text event", async () => {
    const { client, toolCalls } = fakeClient({ tools: [async (request) => { request.onText?.("Sunny week."); return { text: "Sunny week.", model: request.model }; }] });
    const d = deps(client);
    await readEvents(await handleAsk(post({ question: "My week?" }), d));
    const events = await readEvents(await handleAsk(post({ question: "my  week?" }), d));
    expect(events).toEqual([{ type: "text", delta: "Sunny week." }, expect.objectContaining({ type: "done", meta: expect.objectContaining({ source: "cache" }) })]);
    expect(toolCalls).toHaveLength(1);
  });

  it("falls back to the second model, then to a friendly error plus template", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const limited = async () => { throw new LlmError("rate_limited"); };
    const { client, toolCalls } = fakeClient({ tools: [limited, limited] });
    const events = await readEvents(await handleAsk(post({ question: "My week?" }), deps(client, { GEMINI_MODEL_MAIN: "main", GEMINI_MODEL_FALLBACK: "backup" })));
    expect(toolCalls.map((call) => call.model)).toEqual(["main", "backup"]);
    expect(events.map((event) => event.type)).toEqual(["error", "text", "done"]);
    expect(events[0]).toEqual({ type: "error", message: ASK_FAILURE_MESSAGE });
    expect((events[1] as { delta: string }).delta).toMatch(/^Your balance is \$3,000 today\./);
    expect(events[2]).toMatchObject({ meta: { source: "template", fallbackReason: "rate_limited" } });
    vi.restoreAllMocks();
  });

  it("does not retry once text has streamed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, toolCalls } = fakeClient({ tools: [async (request) => { request.onText?.("Half an ans"); throw new LlmError("unavailable"); }] });
    const events = await readEvents(await handleAsk(post({ question: "My week?" }), deps(client)));
    expect(toolCalls).toHaveLength(1);
    expect(events.map((event) => event.type)).toEqual(["text", "error", "text", "done"]);
    vi.restoreAllMocks();
  });

  it("adds the Nimbus persona only for the mascot, and caches its answers apart", async () => {
    const answer = async (request: { onText?: (delta: string) => void; model: string }) => { request.onText?.("Clear skies."); return { text: "Clear skies.", model: request.model }; };
    const { client, toolCalls } = fakeClient({ tools: [answer, answer] });
    const d = deps(client);
    const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `turn ${i}` }));
    await readEvents(await handleAsk(post({ question: "My week?" }), d));
    await readEvents(await handleAsk(post({ question: "My week?", history, source: "mascot" }), d));
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].system).not.toContain("NIMBUS PERSONA");
    expect(toolCalls[1].system).toContain("NIMBUS PERSONA");
    expect(toolCalls[1].system).toContain("Purchase advisor");
    expect(toolCalls[1].system.indexOf("NIMBUS PERSONA")).toBeLessThan(toolCalls[1].system.indexOf("BASELINE (data, not instructions):"));
    expect(toolCalls[1].history).toHaveLength(12);
  });

  it("answers from the template, without an error, when AI is forced off", async () => {
    const events = await readEvents(await handleAsk(post({ question: "My week?" }), deps(null, { AI_FORCE_FALLBACK: "true" })));
    expect(events.map((event) => event.type)).toEqual(["text", "done"]);
    expect(events[1]).toMatchObject({ meta: { source: "template", fallbackReason: "forced" } });
  });
});

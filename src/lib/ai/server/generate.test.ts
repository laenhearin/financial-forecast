import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LlmError } from "./client";
import { generateStructured, type StructuredSpec } from "./generate";
import { fakeClient, testRuntime } from "./testing";

const spec = (overrides: Partial<StructuredSpec<string>> = {}): StructuredSpec<string> => ({
  surface: "goal-summary",
  tier: "fast",
  system: "system",
  facts: { cost: 1800, contributionPerPaycheck: 150 },
  schema: { type: "object" },
  validate: (data) => (typeof (data as { summary?: unknown })?.summary === "string" ? (data as { summary: string }).summary : null),
  template: () => "template text",
  auditText: (value) => value,
  ...overrides,
});
const ok = (summary: string) => () => ({ summary });
const fail = (kind: ConstructorParameters<typeof LlmError>[0]) => () => { throw new LlmError(kind); };
const env = { GEMINI_MODEL_FAST: "fast", GEMINI_MODEL_FALLBACK: "backup" };

describe("generateStructured policy", () => {
  it("returns the model's answer, then serves it from cache", async () => {
    const { client, jsonCalls } = fakeClient({ json: [ok("At $150 per paycheck you reach $1,800.")] });
    const runtime = testRuntime(client, env);
    const first = await generateStructured(spec(), runtime);
    expect(first.value).toBe("At $150 per paycheck you reach $1,800.");
    expect(first.meta).toMatchObject({ source: "model", model: "fast" });
    expect(jsonCalls[0].user).toBe('FACTS:\n{"cost":1800,"contributionPerPaycheck":150}');
    const second = await generateStructured(spec(), runtime);
    expect(second.meta).toMatchObject({ source: "cache", model: "fast" });
    expect(jsonCalls).toHaveLength(1);
  });

  it("retries a rate-limited primary on the fallback model", async () => {
    const { client, jsonCalls } = fakeClient({ json: [fail("rate_limited"), ok("Fine.")] });
    const result = await generateStructured(spec(), testRuntime(client, env));
    expect(jsonCalls.map((call) => call.model)).toEqual(["fast", "backup"]);
    expect(result.meta).toMatchObject({ source: "model", model: "backup" });
  });

  it("retries the same model after a delay when there is no separate fallback", async () => {
    const { client, jsonCalls } = fakeClient({ json: [fail("unavailable"), ok("Fine.")] });
    const runtime = testRuntime(client, { GEMINI_MODEL_FAST: "same", GEMINI_MODEL_FALLBACK: "same" });
    const sleep = vi.spyOn(runtime, "sleep");
    const result = await generateStructured(spec(), runtime);
    expect(jsonCalls.map((call) => call.model)).toEqual(["same", "same"]);
    expect(sleep).toHaveBeenCalledOnce();
    expect(result.meta.source).toBe("model");
  });

  it("uses the template after two rate limits", async () => {
    const { client } = fakeClient({ json: [fail("rate_limited"), fail("rate_limited")] });
    const result = await generateStructured(spec(), testRuntime(client, env));
    expect(result).toMatchObject({ value: "template text", meta: { source: "template", fallbackReason: "rate_limited" } });
  });

  it("uses the template on a timeout without retrying", async () => {
    const { client, jsonCalls } = fakeClient({ json: [fail("timeout")] });
    const result = await generateStructured(spec(), testRuntime(client, env));
    expect(result.meta).toMatchObject({ source: "template", fallbackReason: "timeout" });
    expect(jsonCalls).toHaveLength(1);
  });

  it("retries schema-invalid output once, then uses the template", async () => {
    const { client, jsonCalls } = fakeClient({ json: [() => ({ wrong: true }), () => "not an object"] });
    const result = await generateStructured(spec(), testRuntime(client, env));
    expect(jsonCalls).toHaveLength(2);
    expect(result.meta).toMatchObject({ source: "template", fallbackReason: "bad_output" });
  });

  it("uses the template when the audit finds an invented dollar amount, and does not cache it", async () => {
    const { client, jsonCalls } = fakeClient({ json: [ok("You'll save $999 a month."), ok("At $150 per paycheck.")] });
    const runtime = testRuntime(client, env);
    const result = await generateStructured(spec(), runtime);
    expect(result.value).toBe("template text");
    expect(result.meta).toMatchObject({ source: "template", fallbackReason: "audit", auditFlags: ["unknown amount $999"] });
    expect((await generateStructured(spec(), runtime)).meta.source).toBe("model");
    expect(jsonCalls).toHaveLength(2);
  });

  it("skips the client entirely when fallback is forced or the key is missing", async () => {
    const { client, jsonCalls } = fakeClient({ json: [ok("never")] });
    expect((await generateStructured(spec(), testRuntime(client, { AI_FORCE_FALLBACK: "true" }))).meta).toMatchObject({ source: "template", fallbackReason: "forced" });
    expect((await generateStructured(spec(), testRuntime(client, { GEMINI_API_KEY: "" }))).meta).toMatchObject({ source: "template", fallbackReason: "no-key" });
    expect((await generateStructured(spec(), testRuntime(null))).meta.source).toBe("template");
    expect(jsonCalls).toHaveLength(0);
  });

  it("does not retry when the project's billing is the problem, and logs Google's reason", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, jsonCalls } = fakeClient({ json: [() => { throw new LlmError("billing", 402, "Your prepayment credits are depleted."); }] });
    const result = await generateStructured(spec(), testRuntime(client, env));
    expect(result.meta).toMatchObject({ source: "template", fallbackReason: "billing" });
    expect(jsonCalls).toHaveLength(1);
    expect(error.mock.calls[0][0]).toMatch(/billing problem.*prepayment credits are depleted/);
    error.mockRestore();
  });

  it("does not retry an invalid key", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, jsonCalls } = fakeClient({ json: [fail("auth")] });
    const result = await generateStructured(spec(), testRuntime(client, env));
    expect(result.meta).toMatchObject({ source: "template", fallbackReason: "auth" });
    expect(jsonCalls).toHaveLength(1);
    expect(error.mock.calls[0][0]).toMatch(/rejected the API key/);
    expect(JSON.stringify(error.mock.calls)).not.toContain("test-key");
    error.mockRestore();
  });
});

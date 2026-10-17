import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

// A stand-in for the SDK's interactions.create: each call returns the next scripted reply.
const create = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create };
  },
}));

import { createGeminiClient, LlmError, normalizeLlmError, thinkingFor } from "./client";

async function* events(...list: unknown[]) {
  for (const event of list) yield event;
}
const signal = () => new AbortController().signal;

beforeEach(() => create.mockReset());

describe("normalizeLlmError", () => {
  it("maps SDK and network errors to safe kinds", () => {
    expect(normalizeLlmError({ name: "RateLimitError", status: 429 }).kind).toBe("rate_limited");
    expect(normalizeLlmError({ message: "RESOURCE_EXHAUSTED: quota" }).kind).toBe("rate_limited");
    expect(normalizeLlmError({ name: "InternalServerError", status: 503 }).kind).toBe("unavailable");
    expect(normalizeLlmError({ name: "APIConnectionError" }).kind).toBe("unavailable");
    expect(normalizeLlmError({ name: "APIConnectionTimeoutError" }).kind).toBe("timeout");
    expect(normalizeLlmError({ name: "AuthenticationError", status: 401 }).kind).toBe("auth");
    expect(normalizeLlmError({ status: 400, message: "API key not valid" }).kind).toBe("auth");
    // The shape the Interactions client actually throws for a bad key (checked against the live API).
    expect(normalizeLlmError({ name: "BadRequestError", status: 400, message: "400 API error occurred: {}", body: '[{"error":{"code":400,"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}]' }).kind).toBe("auth");
    expect(normalizeLlmError({ status: 400 }).kind).toBe("other");
    const aborted = new AbortController();
    aborted.abort();
    expect(normalizeLlmError(new Error("x"), aborted.signal).kind).toBe("timeout");
    expect(normalizeLlmError(new LlmError("bad_output")).kind).toBe("bad_output");
  });

  it("keeps upstream text out of the message, but keeps Google's reason as a log detail", () => {
    const error = normalizeLlmError({ status: 500, body: '{"error":{"message":"Backend overloaded.\\nTry later."}}' });
    expect(error.message).not.toContain("overloaded");
    expect(error.detail).toBe("Backend overloaded. Try later.");
  });

  it("separates depleted prepaid credits (402) and per-model denials (403) from a bad key", () => {
    // The shape the live API returned for a project whose prepaid credits ran out.
    const billing = normalizeLlmError({ name: "APIError", status: 402, body: '[{ "error": { "code": 402, "message": "Your prepayment credits are depleted. Please go to AI Studio.", "status": "RESOURCE_EXHAUSTED" } } ]' });
    expect(billing.kind).toBe("billing");
    expect(billing.detail).toBe("Your prepayment credits are depleted. Please go to AI Studio.");
    expect(normalizeLlmError({ name: "PermissionDeniedError", status: 403 }).kind).toBe("unavailable");
    expect(normalizeLlmError({ status: 429, body: '{"error":{"message":"You exceeded your current quota, please check your plan and billing details."}}' }).kind).toBe("rate_limited");
  });
});

describe("thinkingFor", () => {
  it("raises minimal to low on non-lite models", () => {
    expect(thinkingFor("gemini-3.5-flash-lite", "minimal")).toBe("minimal");
    expect(thinkingFor("gemini-3.8-flash", "minimal")).toBe("low");
    expect(thinkingFor("gemini-3.8-flash", "medium")).toBe("medium");
  });
});

describe("Gemini client: structured output", () => {
  it("sends the schema as response_format and parses output_text", async () => {
    create.mockResolvedValueOnce({ status: "completed", output_text: '{"summary":"Hi"}' });
    const client = createGeminiClient("key");
    const result = await client.generateJson({ model: "gemini-3.5-flash-lite", system: "sys", user: "FACTS", schema: { type: "object" }, thinking: "minimal", signal: signal() });
    expect(result).toEqual({ data: { summary: "Hi" }, model: "gemini-3.5-flash-lite" });
    const [params, options] = create.mock.calls[0];
    expect(params).toMatchObject({
      model: "gemini-3.5-flash-lite", system_instruction: "sys", input: "FACTS", store: false,
      response_format: { type: "text", mime_type: "application/json", schema: { type: "object" } },
      generation_config: { thinking_level: "minimal" },
    });
    expect(options).toMatchObject({ retries: { strategy: "none" } });
    expect(options.fetch_options.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports unparseable or incomplete output as bad_output, and SDK errors by kind", async () => {
    const client = createGeminiClient("key");
    const request = { model: "m", system: "s", user: "u", schema: {}, signal: signal() };
    create.mockResolvedValueOnce({ status: "completed", output_text: "not json" });
    await expect(client.generateJson(request)).rejects.toMatchObject({ kind: "bad_output" });
    create.mockResolvedValueOnce({ status: "incomplete", output_text: "{" });
    await expect(client.generateJson(request)).rejects.toMatchObject({ kind: "bad_output" });
    create.mockRejectedValueOnce(Object.assign(new Error("429"), { name: "RateLimitError", status: 429 }));
    await expect(client.generateJson(request)).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

describe("Gemini client: tool rounds", () => {
  it("runs a function call, sends the result back by interaction id, and streams the answer", async () => {
    create
      .mockResolvedValueOnce(events(
        { event_type: "interaction.created", interaction: { id: "i1", status: "in_progress" } },
        { event_type: "step.start", index: 0, step: { type: "function_call", id: "call-1", name: "checkPurchase", arguments: {} } },
        { event_type: "step.delta", index: 0, delta: { type: "arguments_delta", arguments: '{"amount":' } },
        { event_type: "step.delta", index: 0, delta: { type: "arguments_delta", arguments: "300}" } },
        { event_type: "interaction.completed", interaction: { id: "i1", status: "requires_action" } },
      ))
      .mockResolvedValueOnce(events(
        { event_type: "interaction.created", interaction: { id: "i2", status: "in_progress" } },
        { event_type: "step.delta", index: 0, delta: { type: "text", text: "Yes, " } },
        { event_type: "step.delta", index: 0, delta: { type: "text", text: "you can." } },
        { event_type: "interaction.completed", interaction: { id: "i2", status: "completed" } },
      ));
    const tools: string[] = [];
    const text: string[] = [];
    const handler = vi.fn(async () => ({ level: 1 }));
    const result = await createGeminiClient("key").runTools({
      model: "gemini-3.8-flash", system: "sys", question: "Can I afford $300?",
      history: [{ role: "user", text: "hi" }, { role: "assistant", text: "hello" }],
      tools: [{ name: "checkPurchase", description: "d", parameters: { type: "object" } }],
      toolHandler: handler, maxToolRounds: 2, signal: signal(),
      onToolCall: (name) => tools.push(name), onText: (delta) => text.push(delta),
    });

    expect(result).toEqual({ text: "Yes, you can.", model: "gemini-3.8-flash" });
    expect(handler).toHaveBeenCalledWith("checkPurchase", { amount: 300 });
    expect(tools).toEqual(["checkPurchase"]);
    expect(text).toEqual(["Yes, ", "you can."]);
    const [first, second] = create.mock.calls.map(([params]) => params);
    expect(first).toMatchObject({
      stream: true, tools: [{ type: "function", name: "checkPurchase" }], generation_config: { tool_choice: "auto" },
      input: [
        { type: "user_input", content: [{ type: "text", text: "hi" }] },
        { type: "model_output", content: [{ type: "text", text: "hello" }] },
        { type: "user_input", content: [{ type: "text", text: "Can I afford $300?" }] },
      ],
    });
    expect(second).toMatchObject({
      previous_interaction_id: "i1",
      input: [{ type: "function_result", call_id: "call-1", name: "checkPurchase", result: [{ type: "text", text: '{"level":1}' }] }],
    });
  });

  it("forces a text answer once the tool rounds are used up", async () => {
    const call = (id: string) => events(
      { event_type: "interaction.created", interaction: { id, status: "in_progress" } },
      { event_type: "interaction.completed", interaction: { id, status: "requires_action", steps: [{ type: "function_call", id: `c-${id}`, name: "getForecast", arguments: { startDate: "a" } }] } },
    );
    create
      .mockResolvedValueOnce(call("i1"))
      .mockResolvedValueOnce(events({ event_type: "step.delta", index: 0, delta: { type: "text", text: "Here's what I found." } }));
    const handler = vi.fn(async () => ({}));
    const result = await createGeminiClient("key").runTools({
      model: "m", system: "s", question: "q", history: [], tools: [], toolHandler: handler, maxToolRounds: 1, signal: signal(),
    });
    expect(result.text).toBe("Here's what I found.");
    expect(handler).toHaveBeenCalledWith("getForecast", { startDate: "a" });
    expect(create.mock.calls[1][0]).toMatchObject({ generation_config: { tool_choice: "none" } });
  });

  it("maps a stream error event to a kind", async () => {
    create.mockResolvedValueOnce(events({ event_type: "error", error: { code: "RESOURCE_EXHAUSTED" } }));
    await expect(createGeminiClient("key").runTools({
      model: "m", system: "s", question: "q", history: [], tools: [], toolHandler: async () => ({}), maxToolRounds: 2, signal: signal(),
    })).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

import "server-only";
import { GoogleGenAI, type Interactions } from "@google/genai";

/**
 * The only module that talks to Gemini. It uses the Interactions API (`ai.interactions.create`),
 * which is what the current Gemini quickstart, structured-output, function-calling and streaming
 * guides show (checked against @google/genai 2.30 types). Everything above this file depends on
 * the LlmClient interface, so tests inject a fake and never call the network.
 */

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
export type LlmErrorKind = "rate_limited" | "billing" | "unavailable" | "timeout" | "bad_output" | "auth" | "other";

export class LlmError extends Error {
  /**
   * `detail` is Google's own short reason (for example "Your prepayment credits are depleted"), kept
   * for server logs only. The message stays generic so nothing upstream can reach the browser.
   */
  constructor(readonly kind: LlmErrorKind, readonly status?: number, readonly detail?: string) {
    super(`LLM request failed: ${kind}${status ? ` (${status})` : ""}`);
    this.name = "LlmError";
  }
}

export interface JsonRequest {
  model: string;
  system: string;
  user: string;
  /** JSON Schema for the response (structured output). */
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
  thinking?: ThinkingLevel;
  signal: AbortSignal;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolRunRequest {
  model: string;
  system: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  question: string;
  tools: readonly ToolDeclaration[];
  toolHandler: (name: string, args: unknown) => Promise<unknown>;
  /** Rounds of tool calls allowed before the model must answer in text. */
  maxToolRounds: number;
  maxOutputTokens?: number;
  temperature?: number;
  thinking?: ThinkingLevel;
  signal: AbortSignal;
  onToolCall?: (name: string) => void;
  onText?: (delta: string) => void;
}

export interface LlmClient {
  generateJson(request: JsonRequest): Promise<{ data: unknown; model: string }>;
  /** Tool rounds, then the answer streamed through onText. Resolves with the full text. */
  runTools(request: ToolRunRequest): Promise<{ text: string; model: string }>;
}

/** Lite models accept "minimal" thinking; other Flash models start at "low". */
export function thinkingFor(model: string, wanted: ThinkingLevel): ThinkingLevel {
  return wanted === "minimal" && !/lite/i.test(model) ? "low" : wanted;
}

export function createGeminiClient(apiKey: string): LlmClient {
  const ai = new GoogleGenAI({ apiKey });
  // Our generate policy owns retries and model fallback, so the SDK must not retry on its own.
  const options = (signal: AbortSignal) => ({ fetch_options: { signal }, retries: { strategy: "none" as const } });

  return {
    async generateJson(request) {
      let interaction: Awaited<ReturnType<typeof ai.interactions.create>> & { output_text?: string; status?: string };
      try {
        interaction = await ai.interactions.create({
          model: request.model,
          system_instruction: request.system,
          input: request.user,
          response_format: { type: "text", mime_type: "application/json", schema: request.schema },
          generation_config: {
            temperature: request.temperature,
            max_output_tokens: request.maxOutputTokens,
            thinking_level: request.thinking ? thinkingFor(request.model, request.thinking) : undefined,
          },
          // One-shot calls don't need server-side history.
          store: false,
        }, options(request.signal));
      } catch (error) {
        throw normalizeLlmError(error, request.signal);
      }
      if (interaction.status && interaction.status !== "completed") throw new LlmError("bad_output");
      const text = interaction.output_text?.trim();
      if (!text) throw new LlmError("bad_output");
      try {
        return { data: JSON.parse(text), model: request.model };
      } catch {
        throw new LlmError("bad_output");
      }
    },

    async runTools(request) {
      const tools: Interactions.Tool[] = request.tools.map((tool) => ({ type: "function", ...tool }));
      let input: Interactions.InteractionCreateParams["input"] = [
        ...request.history.map(turnStep),
        turnStep({ role: "user", text: request.question }),
      ];
      let previousId: string | undefined;
      let text = "";

      for (let round = 0; ; round++) {
        const mustAnswer = round >= request.maxToolRounds;
        let result: StreamedRound;
        try {
          const stream = await ai.interactions.create({
            model: request.model,
            system_instruction: request.system,
            input,
            tools,
            previous_interaction_id: previousId,
            stream: true,
            generation_config: {
              temperature: request.temperature,
              max_output_tokens: request.maxOutputTokens,
              thinking_level: request.thinking ? thinkingFor(request.model, request.thinking) : undefined,
              tool_choice: mustAnswer ? "none" : "auto",
            },
          }, options(request.signal));
          result = await readRound(stream, (delta) => {
            text += delta;
            request.onText?.(delta);
          });
        } catch (error) {
          throw normalizeLlmError(error, request.signal);
        }

        if (!result.calls.length || mustAnswer) {
          if (!text.trim()) throw new LlmError("bad_output");
          return { text, model: request.model };
        }
        if (!result.interactionId) throw new LlmError("bad_output");

        const outputs: Interactions.Step[] = [];
        for (const call of result.calls) {
          request.onToolCall?.(call.name);
          const output = await request.toolHandler(call.name, call.args);
          outputs.push({ type: "function_result", call_id: call.id, name: call.name, result: [{ type: "text", text: JSON.stringify(output) }] });
        }
        input = outputs;
        previousId = result.interactionId;
      }
    },
  };
}

function turnStep(turn: { role: "user" | "assistant"; text: string }): Interactions.Step {
  const content = [{ type: "text" as const, text: turn.text }];
  return turn.role === "user" ? { type: "user_input", content } : { type: "model_output", content };
}

interface StreamedRound {
  interactionId: string | null;
  calls: Array<{ id: string; name: string; args: unknown }>;
}

/** Forwards text deltas and collects function calls (arguments may arrive whole or as deltas). */
async function readRound(stream: AsyncIterable<Interactions.InteractionSSEEvent>, onText: (delta: string) => void): Promise<StreamedRound> {
  let interactionId: string | null = null;
  const pending = new Map<number, { id: string; name: string; initial: Record<string, unknown>; argText: string }>();
  let completedCalls: Interactions.FunctionCallStep[] | null = null;

  for await (const event of stream) {
    switch (event.event_type) {
      case "interaction.created":
        interactionId = event.interaction.id;
        break;
      case "step.start":
        if (event.step.type === "function_call") {
          pending.set(event.index, { id: event.step.id, name: event.step.name, initial: event.step.arguments ?? {}, argText: "" });
        } else if (event.step.type === "model_output") {
          for (const part of event.step.content ?? []) if (part.type === "text" && part.text) onText(part.text);
        }
        break;
      case "step.delta":
        if (event.delta.type === "text") onText(event.delta.text);
        else if (event.delta.type === "arguments_delta") {
          const call = pending.get(event.index);
          if (call) call.argText += event.delta.arguments ?? "";
        }
        break;
      case "interaction.completed":
        interactionId = event.interaction.id;
        if (event.interaction.status === "failed") throw new LlmError("unavailable");
        completedCalls = (event.interaction.steps ?? []).filter((step): step is Interactions.FunctionCallStep => step.type === "function_call");
        break;
      case "error":
        throw errorFromCode(event.error?.code);
    }
  }

  // Prefer the completed interaction's calls (whole arguments); otherwise use what streamed.
  const calls = completedCalls?.length
    ? completedCalls.map((step) => ({ id: step.id, name: step.name, args: step.arguments }))
    : [...pending.values()].map((call) => ({ id: call.id, name: call.name, args: call.argText ? parseArgs(call.argText) : call.initial }));
  return { interactionId, calls };
}

function parseArgs(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { _unparseable: true };
  }
}

function errorFromCode(code: string | undefined): LlmError {
  if (code && /RESOURCE_EXHAUSTED|429/i.test(code)) return new LlmError("rate_limited", 429, code);
  if (code && /UNAVAILABLE|INTERNAL|PERMISSION_DENIED|50\d/i.test(code)) return new LlmError("unavailable", undefined, code);
  if (code && /UNAUTHENTICATED/i.test(code)) return new LlmError("auth", undefined, code);
  return new LlmError("other", undefined, code);
}

/**
 * Maps SDK and network errors to a small, safe set. Google's short reason is kept as `detail` for
 * server logs; nothing upstream is ever returned to the browser.
 */
export function normalizeLlmError(error: unknown, signal?: AbortSignal): LlmError {
  if (error instanceof LlmError) return error;
  if (signal?.aborted) return new LlmError("timeout");
  const info = (error ?? {}) as { name?: unknown; status?: unknown; statusCode?: unknown; message?: unknown; body?: unknown };
  const status = typeof info.status === "number" ? info.status : typeof info.statusCode === "number" ? info.statusCode : undefined;
  const name = typeof info.name === "string" ? info.name : "";
  // The Interactions client puts Google's error (for example API_KEY_INVALID) in `body`, not `message`.
  const message = [info.message, info.body].map((part) => (typeof part === "string" ? part : part ? safeJson(part) : "")).join(" ");
  const detail = upstreamReason(message);
  if (/Timeout/i.test(name) || name === "AbortError" || name === "APIUserAbortError") return new LlmError("timeout", status, detail);
  // 402: the project's prepaid credits are used up. Every model on the key fails, so no retry helps.
  if (status === 402 || /prepayment credits/i.test(detail ?? "")) return new LlmError("billing", status, detail);
  if (status === 429 || /RESOURCE_EXHAUSTED/.test(message)) return new LlmError("rate_limited", 429, detail);
  if (status === 401 || /API_KEY_INVALID|API key not valid|UNAUTHENTICATED/i.test(message)) return new LlmError("auth", status, detail);
  // 403 is usually one model the project can't use; the fallback model may still work.
  if (status === 403 || /PERMISSION_DENIED/.test(message)) return new LlmError("unavailable", status, detail);
  if ((status !== undefined && status >= 500) || /Connection/i.test(name)) return new LlmError("unavailable", status, detail);
  return new LlmError("other", status, detail);
}

/** Google's "message" field from an error body, as one short line. */
function upstreamReason(text: string): string | undefined {
  const match = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  const reason = (match ? match[1].replace(/\\n/g, " ") : "").replace(/\s+/g, " ").trim();
  return reason ? reason.slice(0, 200) : undefined;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

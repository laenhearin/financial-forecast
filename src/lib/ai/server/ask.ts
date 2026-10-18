import "server-only";
import { auditNumbers } from "../audit";
import { buildBaseline } from "../facts/baseline";
import { askTemplate } from "../fallbacks";
import { toPromptFacts } from "../promptJson";
import { askSystemPrompt } from "../prompts/system-ask";
import { MASCOT_PERSONA } from "../prompts/system-mascot";
import type { AiFallbackReason, AiMeta, AskRequest, AskStreamEvent } from "../types";
import { cacheKey } from "./cache";
import { normalizeLlmError } from "./client";
import { templateOnlyReason } from "./config";
import type { FinanceContext } from "./context";
import { logFailure } from "./generate";
import { retryDelayMs, timeoutSignal, type AiRuntime } from "./runtime";
import { describeToolCall, dispatchTool, TOOL_DECLARATIONS } from "./tools";

export const ASK_MAX_TOOL_ROUNDS = 2;
/** Fixed text the browser shows before the template overview. Never upstream error text. */
export const ASK_FAILURE_MESSAGE = "I couldn't reach the assistant just now. Here's what your forecast shows.";

const RETRYABLE = new Set<AiFallbackReason>(["rate_limited", "unavailable", "bad_output"]);

/**
 * Answers one ask-box question as a stream of events: tool hints, text deltas, then done.
 * Tool progress streams immediately. Answer text is held until its number audit passes; failed or
 * unsupported answers never reach the browser. Provider failures retry once, then use a template.
 */
export async function runAsk(request: AskRequest, context: FinanceContext, runtime: AiRuntime, emit: (event: AskStreamEvent) => void, signal?: AbortSignal): Promise<void> {
  const started = runtime.now();
  const elapsed = () => Math.round(runtime.now() - started);
  const baseline = toPromptFacts(buildBaseline(context.scenario, context.purchases, context.criticalCents, context.entries));
  const template = () => askTemplate(buildBaseline(context.scenario, context.purchases, context.criticalCents, context.entries), request.question);
  const finishWithTemplate = (fallbackReason: AiFallbackReason, failed: boolean) => {
    if (failed) emit({ type: "error", message: ASK_FAILURE_MESSAGE });
    emit({ type: "text", delta: template() });
    emit({ type: "done", meta: { source: "template", latencyMs: elapsed(), fallbackReason } });
  };

  const off = templateOnlyReason(runtime.config);
  if (off || !runtime.client) return finishWithTemplate(off ?? "no-key", false);

  const main = runtime.config.models.main;
  // Nimbus answers in its own voice, so its answers are cached apart from the ask box's.
  const mascot = request.source === "mascot";
  // Tools see the full horizon and account distribution, not just the compact two-week baseline.
  // Include that context so switching customers or changing a later purchase cannot reuse an answer.
  const key = cacheKey(mascot ? "ask-mascot" : "ask", main, { context, history: request.history }, request.question);
  const hit = runtime.cache.get(key) as { text: string; model: string } | undefined;
  if (hit) {
    emit({ type: "text", delta: hit.text });
    emit({ type: "done", meta: { source: "cache", model: hit.model, latencyMs: elapsed() } });
    return;
  }

  const fallback = runtime.config.models.fallback;
  const attempts = [main, fallback !== main ? fallback : main];
  const id = runtime.requestId();
  const system = askSystemPrompt(JSON.stringify(baseline), mascot ? MASCOT_PERSONA : undefined);
  let reason: AiFallbackReason = "other";

  for (const [index, model] of attempts.entries()) {
    if (index > 0 && model === attempts[index - 1]) await runtime.sleep(retryDelayMs());
    const toolResults: unknown[] = [];
    try {
      const { text } = await runtime.client.runTools({
        model,
        system,
        history: request.history,
        question: request.question,
        tools: TOOL_DECLARATIONS,
        maxToolRounds: ASK_MAX_TOOL_ROUNDS,
        maxOutputTokens: 800,
        temperature: 0.25,
        thinking: "low",
        // Tool rounds plus the answer: allow two request timeouts in total.
        signal: timeoutSignal(runtime.config.timeoutMs * 2, signal),
        onToolCall: (name) => emit({ type: "tool", name }),
        // The client returns the complete answer below. Do not expose unaudited partial text.
        toolHandler: async (name, args) => {
          console.debug(`[ai ${id}] ask tool ${describeToolCall(name, args)}`);
          const result = dispatchTool(name, args, context);
          toolResults.push(result);
          return result;
        },
      });
      const audit = auditNumbers(text, [baseline, ...toolResults]);
      if (!audit.ok) {
        console.warn(`[ai ${id}] ask audit rejected ${model}`);
        return finishWithTemplate("audit", false);
      }
      const meta: AiMeta = { source: "model", model, latencyMs: elapsed() };
      runtime.cache.set(key, { text, model });
      emit({ type: "text", delta: text });
      emit({ type: "done", meta });
      return;
    } catch (error) {
      const failure = normalizeLlmError(error, signal);
      reason = failure.kind;
      logFailure(id, "ask", model, failure);
      if (!RETRYABLE.has(failure.kind)) break;
    }
  }
  finishWithTemplate(reason, true);
}

import "server-only";
import { auditNumbers } from "../audit";
import { buildBaseline } from "../facts/baseline";
import { askTemplate } from "../fallbacks";
import { toPromptFacts } from "../promptJson";
import { askSystemPrompt } from "../prompts/system-ask";
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
 * Tool rounds call the engine; the final answer streams. Failures before any text retry once
 * (fallback model, or the same model after a short delay); otherwise the stream ends with a
 * friendly error and a template overview, so the panel is never empty.
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
  const key = cacheKey("ask", main, { baseline, history: request.history }, request.question);
  const hit = runtime.cache.get(key) as { text: string; model: string } | undefined;
  if (hit) {
    emit({ type: "text", delta: hit.text });
    emit({ type: "done", meta: { source: "cache", model: hit.model, latencyMs: elapsed() } });
    return;
  }

  const fallback = runtime.config.models.fallback;
  const attempts = [main, fallback !== main ? fallback : main];
  const id = runtime.requestId();
  const system = askSystemPrompt(JSON.stringify(baseline));
  let reason: AiFallbackReason = "other";

  for (const [index, model] of attempts.entries()) {
    if (index > 0 && model === attempts[index - 1]) await runtime.sleep(retryDelayMs());
    const toolResults: unknown[] = [];
    let sentText = false;
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
        onText: (delta) => {
          sentText = true;
          emit({ type: "text", delta });
        },
        toolHandler: async (name, args) => {
          console.debug(`[ai ${id}] ask tool ${describeToolCall(name, args)}`);
          const result = dispatchTool(name, args, context);
          toolResults.push(result);
          return result;
        },
      });
      // Text already streamed can't be retracted, so the audit flags rather than replaces it.
      const audit = auditNumbers(text, [baseline, ...toolResults]);
      const meta: AiMeta = { source: "model", model, latencyMs: elapsed(), ...(audit.ok ? {} : { auditFlags: audit.flags }) };
      if (audit.ok) runtime.cache.set(key, { text, model });
      else console.warn(`[ai ${id}] ask audit flagged ${model}: ${audit.flags.join("; ")}`);
      emit({ type: "done", meta });
      return;
    } catch (error) {
      const failure = normalizeLlmError(error, signal);
      reason = failure.kind;
      logFailure(id, "ask", model, failure);
      if (sentText || !RETRYABLE.has(failure.kind)) break;
    }
  }
  finishWithTemplate(reason, true);
}

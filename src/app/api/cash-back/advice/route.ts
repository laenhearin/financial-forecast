import type { AdviceResponse } from "@/features/cash-back/ai/api";
import { parseAdviceFacts } from "@/features/cash-back/ai/facts";
import { templateNarration } from "@/features/cash-back/ai/narrator";
import { AiError, isAiConfigured, narrateAdvice } from "@/features/cash-back/server/claude";
import { json, readJsonBody } from "@/features/cash-back/server/http";

/**
 * Turns the engine's computed results into plain-language advice. The browser sends a small, validated
 * summary (no raw purchases). Without an API key, or when the AI call fails, the templated summary is returned.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const facts = parseAdviceFacts(body.value);
  if (!facts) return json({ status: "error", message: "The advice request was not in the expected format." }, 400);

  const fallback = templateNarration(facts);
  if (!isAiConfigured()) {
    return json({ status: "template", text: fallback, message: "AI advice is off because ANTHROPIC_API_KEY is not set." } satisfies AdviceResponse);
  }
  try {
    return json({ status: "ai", text: await narrateAdvice(facts) } satisfies AdviceResponse);
  } catch (error) {
    const aiError = error instanceof AiError ? error : new AiError("The AI request failed.", 500);
    return json({ status: "error", text: fallback, message: aiError.message } satisfies AdviceResponse, aiError.status);
  }
}

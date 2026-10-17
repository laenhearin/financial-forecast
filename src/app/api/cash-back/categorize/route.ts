import type { CategorizeResponse } from "@/features/cash-back/ai/api";
import { parseMerchantList } from "@/features/cash-back/ai/api";
import { MAX_AI_MERCHANTS, MAX_MERCHANT_LENGTH } from "@/features/cash-back/config";
import { AiError, classifyMerchants, isAiConfigured } from "@/features/cash-back/server/claude";
import { json, readJsonBody } from "@/features/cash-back/server/http";

/** Classifies merchant names the keyword list missed. Read-only: no bank data is changed. */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const merchants = parseMerchantList(body.value);
  if (!merchants) {
    return json({ status: "error", message: `Send { merchants: [...] } with 1 to ${MAX_AI_MERCHANTS} names of up to ${MAX_MERCHANT_LENGTH} characters.` } satisfies CategorizeResponse, 400);
  }
  if (!isAiConfigured()) {
    return json({ status: "unavailable", message: "AI classification is off because ANTHROPIC_API_KEY is not set." } satisfies CategorizeResponse);
  }
  try {
    const categories = await classifyMerchants(merchants);
    return json({ status: "ok", categories } satisfies CategorizeResponse);
  } catch (error) {
    const aiError = error instanceof AiError ? error : new AiError("The AI request failed.", 500);
    return json({ status: "error", message: aiError.message } satisfies CategorizeResponse, aiError.status);
  }
}

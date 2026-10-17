import { loadFinanceContext } from "@/lib/ai/server/context";
import { handleAdvisor } from "@/lib/ai/server/handlers";
import { getAiRuntime } from "@/lib/ai/server/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Read-only AI route. Numbers come from the forecast engine; the model only words them. */
export async function POST(request: Request) {
  return handleAdvisor(request, { runtime: getAiRuntime(), loadContext: loadFinanceContext });
}

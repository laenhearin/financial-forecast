import { handleCompare } from "@/features/cash-back/server/compare";
import { loadActiveProfile } from "@/lib/active-customer";
import { getAiRuntime } from "@/lib/ai/server/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Read-only AI overview of a card comparison. Numbers come from the rewards engine; the model only words them. */
export async function POST(request: Request) {
  return handleCompare(request, { runtime: getAiRuntime(), loadProfile: async () => (await loadActiveProfile()).cashBack });
}

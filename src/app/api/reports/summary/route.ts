import { getAiRuntime } from "@/lib/ai/server/runtime";
import { handleReportSummary } from "@/lib/reports/summaryHandler";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
export async function POST(request: Request) {
  return handleReportSummary(request, getAiRuntime());
}

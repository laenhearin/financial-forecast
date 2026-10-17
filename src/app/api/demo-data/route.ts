import { NextResponse } from "next/server";
import { loadActiveDemo } from "@/lib/active-demo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const demo = await loadActiveDemo();
    return NextResponse.json({
      scenario: demo.scenario,
      cashBack: demo.cashBack,
      goal: demo.goal,
      sourceLabel: demo.sourceLabel,
      isFixture: demo.isFixture,
      asOfDate: demo.asOfDate,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The selected demo profile could not be loaded.";
    return NextResponse.json({ message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

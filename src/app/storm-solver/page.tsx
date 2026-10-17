import type { Metadata } from "next";
import { ScenarioLoadError } from "@/data/dataSource";
import { loadActiveDemo } from "@/lib/active-demo";
import { CalendarLoadError } from "@/features/calendar/components/CalendarLoadError";
import { StormSolverApp } from "@/features/calendar/components/StormSolverApp";

export const metadata: Metadata = { title: "Storm Solver" };

export default async function StormSolverPage() {
  let demo: Awaited<ReturnType<typeof loadActiveDemo>>;
  try {
    demo = await loadActiveDemo();
  } catch (error) {
    return <CalendarLoadError
      title="Storm Solver"
      message={error instanceof Error ? error.message : "Unknown error."}
      details={error instanceof ScenarioLoadError ? error.details : []}
    />;
  }
  return <StormSolverApp scenario={demo.scenario} sourceLabel="Synthetic Nessie data + local demo assumptions" isFixture />;
}

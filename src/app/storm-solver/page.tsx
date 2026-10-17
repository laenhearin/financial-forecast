import type { Metadata } from "next";
import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { ScenarioLoadError } from "@/data/dataSource";
import { loadActiveProfile } from "@/lib/active-customer";
import { CalendarLoadError } from "@/features/calendar/components/CalendarLoadError";
import { StormSolverApp } from "@/features/calendar/components/StormSolverApp";

export const metadata: Metadata = { title: "Storm Solver" };

export default async function StormSolverPage() {
  let profile: Awaited<ReturnType<typeof loadActiveProfile>>;
  try {
    profile = await loadActiveProfile();
  } catch (error) {
    return <CalendarLoadError
      title="Storm Solver"
      message={error instanceof Error ? error.message : "Unknown error."}
      details={error instanceof ScenarioLoadError ? error.details : []}
    />;
  }
  return (
    <ActiveCustomerProvider customer={profile.customer}>
      <StormSolverApp key={profile.scenario.id} scenario={profile.scenario} />
    </ActiveCustomerProvider>
  );
}

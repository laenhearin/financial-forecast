import type { Metadata } from "next";
import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { ScenarioLoadError } from "@/data/dataSource";
import { loadActiveProfile } from "@/lib/active-customer";
import { CalendarLoadError } from "@/features/calendar/components/CalendarLoadError";
import { PurchaseAdvisorApp } from "@/features/calendar/components/PurchaseAdvisorApp";

export const metadata: Metadata = { title: "Purchase Advisor" };

export default async function PurchaseAdvisorPage() {
  let profile: Awaited<ReturnType<typeof loadActiveProfile>>;
  try {
    profile = await loadActiveProfile();
  } catch (error) {
    return <CalendarLoadError
      title="Purchase Advisor"
      message={error instanceof Error ? error.message : "Unknown error."}
      details={error instanceof ScenarioLoadError ? error.details : []}
    />;
  }
  return (
    <ActiveCustomerProvider customer={profile.customer}>
      <PurchaseAdvisorApp key={profile.scenario.id} scenario={profile.scenario} />
    </ActiveCustomerProvider>
  );
}

import type { Metadata } from "next";
import { ScenarioLoadError } from "@/data/dataSource";
import { loadActiveDemo } from "@/lib/active-demo";
import { CalendarLoadError } from "@/features/calendar/components/CalendarLoadError";
import { PurchaseAdvisorApp } from "@/features/calendar/components/PurchaseAdvisorApp";

export const metadata: Metadata = { title: "Purchase Advisor" };

export default async function PurchaseAdvisorPage() {
  let demo: Awaited<ReturnType<typeof loadActiveDemo>>;
  try {
    demo = await loadActiveDemo();
  } catch (error) {
    return <CalendarLoadError
      title="Purchase Advisor"
      message={error instanceof Error ? error.message : "Unknown error."}
      details={error instanceof ScenarioLoadError ? error.details : []}
    />;
  }
  return <PurchaseAdvisorApp scenario={demo.scenario} sourceLabel="Synthetic Nessie data + local demo assumptions" isFixture />;
}

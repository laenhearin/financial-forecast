import type { Metadata } from "next";
import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { ReportsApp } from "@/components/reports/ReportsApp";
import { CalendarLoadError } from "@/features/calendar/components/CalendarLoadError";
import { loadActiveProfile } from "@/lib/active-customer";
export const metadata: Metadata = { title: "Reports" };
export default async function ReportsPage() {
  let profile;
  try { profile = await loadActiveProfile(); }
  catch (error) { return <CalendarLoadError title="Reports" message={error instanceof Error ? error.message : "Unable to load Nessie data."} details={[]} />; }
  return <ActiveCustomerProvider customer={profile.customer}><ReportsApp key={profile.customer.id} profile={profile} /></ActiveCustomerProvider>;
}

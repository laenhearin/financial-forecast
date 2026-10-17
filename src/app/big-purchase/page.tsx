import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { ScenarioLoadError } from "@/data/dataSource";
import { BigPurchaseApp } from "@/features/big-purchase/components/BigPurchaseApp";
import { loadActiveProfile } from "@/lib/active-customer";

export default async function BigPurchasePage() {
  let profile: Awaited<ReturnType<typeof loadActiveProfile>>;
  try {
    profile = await loadActiveProfile();
  } catch (error) {
    return <BigPurchaseApp load={{
      ok: false,
      message: error instanceof Error ? error.message : "The Nessie customer could not be loaded.",
      details: error instanceof ScenarioLoadError ? error.details : [],
    }} />;
  }
  return (
    <ActiveCustomerProvider customer={profile.customer}>
      <BigPurchaseApp load={{ ok: true, scenario: profile.scenario }} />
    </ActiveCustomerProvider>
  );
}

import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { defaultCriticalBalanceCents } from "@/features/calendar/engine/balanceThresholds";
import { findCard } from "@/features/cash-back/cards/catalog";
import { brandedName } from "@/features/cash-back/format";
import { getActiveCustomer, loadActiveProfile } from "@/lib/active-customer";
import { ProfileView, type ProfileAccounts } from "./ProfileView";

/** Lists every Nessie customer this key can read; choosing one changes the customer for every page. */
export default async function ProfilePage() {
  let resolved: Awaited<ReturnType<typeof getActiveCustomer>>;
  try {
    resolved = await getActiveCustomer();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nessie customers could not be loaded.";
    return (
      <div className="mx-auto w-full max-w-180 px-5 py-12 md:px-10">
        <h1 className="text-display font-medium text-primary">Profile</h1>
        <p role="alert" className="mt-7 rounded-panel border border-neg bg-card p-5 text-caption text-secondary">We couldn&apos;t load Nessie customers: {message}</p>
      </div>
    );
  }

  const { customers, active } = resolved;
  // The customer list loaded, so switching still works even if this customer's records do not.
  let accounts: ProfileAccounts;
  try {
    const profile = await loadActiveProfile();
    accounts = {
      ok: true,
      cash: profile.scenario.accounts.map(({ id, nickname, type, balanceCents }) => ({ id, nickname, type, balanceCents })),
      cards: profile.cashBack.ownedCardIds.map(id => findCard(id)).filter(card => card !== undefined).map(brandedName),
      criticalDefaultCents: defaultCriticalBalanceCents(profile.scenario),
      asOfDate: profile.asOfDate,
    };
  } catch (error) {
    accounts = { ok: false, message: error instanceof Error ? error.message : "This customer's records could not be loaded." };
  }

  return (
    <ActiveCustomerProvider customer={active}>
      <ProfileView key={active.id} customers={customers} active={active} accounts={accounts} />
    </ActiveCustomerProvider>
  );
}

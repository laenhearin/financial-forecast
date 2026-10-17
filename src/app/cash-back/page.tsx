import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { CashBackApp } from "@/features/cash-back/components/CashBackApp";
import { loadActiveProfile } from "@/lib/active-customer";

/** /cash-back?suggest=<cardId> opens that card's details, as linked from the homepage. */
export default async function CashBackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { suggest } = await searchParams;
  let profile: Awaited<ReturnType<typeof loadActiveProfile>>;
  try {
    profile = await loadActiveProfile();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Nessie customer could not be loaded.";
    return (
      <div className="mx-auto w-full max-w-350 px-5 py-6 md:px-8 lg:py-7">
        <h1 className="text-display font-medium text-primary">Swipe and Shine</h1>
        <p role="alert" className="mt-4 rounded-panel border border-neg bg-card p-4 text-caption text-secondary">We couldn&apos;t load your data: {message}</p>
      </div>
    );
  }
  return (
    <ActiveCustomerProvider customer={profile.customer}>
      <CashBackApp key={profile.customer.id} profile={profile.cashBack} scenario={profile.scenario} initialCardId={typeof suggest === "string" ? suggest : null} />
    </ActiveCustomerProvider>
  );
}

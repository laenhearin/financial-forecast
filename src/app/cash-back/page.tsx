import { CashBackApp } from "@/features/cash-back/components/CashBackApp";
import { loadActiveDemo } from "@/lib/active-demo";
import { seededCashBackProfile } from "@/features/cash-back/data/source";

/** /cash-back?suggest=<cardId> opens that card's details, as linked from the homepage. */
export default async function CashBackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { suggest } = await searchParams;
  let demo: Awaited<ReturnType<typeof loadActiveDemo>>;
  let profile: ReturnType<typeof seededCashBackProfile>;
  try {
    demo = await loadActiveDemo();
    profile = seededCashBackProfile(demo.cashBack);
  } catch (error) {
    return <p role="alert" className="p-6 text-neg">Could not load rewards: {error instanceof Error ? error.message : "Please try again."}</p>;
  }
  return <CashBackApp key={demo.scenario.id} initialCardId={typeof suggest === "string" ? suggest : null}
    profile={profile} profileSlug={demo.scenario.id.split("/").at(-1)!} scenario={demo.scenario} />;
}

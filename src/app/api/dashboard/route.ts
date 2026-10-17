import { loadActiveProfile } from "@/lib/active-customer";
import { getNessieStatus } from "@/lib/nessie";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Connection check for the active customer. connected is true only after this request read Nessie successfully. */
export async function GET() {
  const status = getNessieStatus();
  try {
    const profile = await loadActiveProfile();
    return Response.json({
      source: profile.sourceLabel,
      nessie: { ...status, connected: true },
      customer: profile.customer,
      asOfDate: profile.asOfDate,
      accounts: profile.scenario.accounts.map(({ nickname, type, balanceCents }) => ({ nickname, type, balanceCents })),
      ownedCardIds: profile.cashBack.ownedCardIds,
    }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nessie data could not be loaded.";
    return Response.json({ nessie: { ...status, connected: false }, message }, { status: 503, headers: NO_STORE });
  }
}

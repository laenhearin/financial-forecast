import { CashBackApp } from "@/features/cash-back/components/CashBackApp";

/** /cash-back?suggest=<cardId> opens that card's details, as linked from the homepage. */
export default async function CashBackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { suggest } = await searchParams;
  return <CashBackApp initialCardId={typeof suggest === "string" ? suggest : null} />;
}

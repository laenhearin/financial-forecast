import { BigPurchaseApp } from "@/features/big-purchase/components/BigPurchaseApp";

export default async function BigPurchasePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { demoGoal } = await searchParams;
  // Dev-only rehearsal shortcut: ?demoGoal=1 seeds the $1,800 laptop as a draft.
  const seedDemoGoal = process.env.NODE_ENV !== "production" && demoGoal === "1";
  return <BigPurchaseApp seedDemoGoal={seedDemoGoal} />;
}

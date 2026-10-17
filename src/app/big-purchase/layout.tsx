import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { bpRootClass } from "@/features/big-purchase/fonts";
import "@/styles/theme.css";

export const metadata: Metadata = { title: "Purchase Forecasting", description: "See the earliest date you can afford a big purchase." };

export default function BigPurchaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bpRootClass} min-h-screen`}>
      <TooltipProvider>{children}</TooltipProvider>
    </div>
  );
}

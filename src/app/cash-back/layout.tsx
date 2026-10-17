import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { bpRootClass } from "@/features/big-purchase/fonts";
import "@/styles/theme.css";

export const metadata: Metadata = {
  title: "Cash Back Maximizer · Financial Forecast",
  description: "Which card to use for each category, and how much cash back you missed.",
};

/** Reuses the Big Purchase design tokens so both feature screens look alike. */
export default function CashBackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bpRootClass} min-h-screen`}>
      <TooltipProvider>{children}</TooltipProvider>
    </div>
  );
}

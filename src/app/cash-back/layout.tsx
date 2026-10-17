import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Swipe and Shine",
  description: "Which of your cards to use for each kind of purchase, and which card is worth adding.",
};

/** Uses the app's Clear Skies and Heavy Rain tokens directly, like the homepage. */
export default function CashBackLayout({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

import Link from "next/link";
import { ROUTES } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { label: "Check a purchase", href: ROUTES.purchaseAdvisor },
  { label: "Save for a goal", href: ROUTES.bigPurchase },
  { label: "Fix my bill dates", href: ROUTES.stormSolver },
];

export function SuggestionChips({ className }: { className?: string }) {
  return (
    <ul aria-label="Suggestions" className={cn("flex flex-wrap justify-center gap-2.5", className)}>
      {SUGGESTIONS.map(({ label, href }) => (
        <li key={href}>
          <Link
            href={href}
            className="ui-transition inline-flex rounded-full border border-app bg-card px-4 py-2 text-caption text-secondary hover:border-accent-line hover:text-primary"
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

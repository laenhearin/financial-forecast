import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { findCard } from "../cards/catalog";
import type { WalletAnalysis } from "../engine/analyze";
import { brandedName, formatWholeDollars, formatYearlyGain } from "../format";
import { tileClass } from "./ui";

const labelClass = "text-caption text-secondary";
const figureClass = "mt-1 text-figure font-semibold text-primary";
const noteClass = "mt-0.5 truncate text-micro text-secondary";

/** Three stat tiles: yearly rewards, gold cards, and the best card to add (hidden when there is none). */
export function SummaryStrip({ analysis, onShowSuggestion }: { analysis: WalletAnalysis; onShowSuggestion: () => void }) {
  const categoriesWon = analysis.gold.reduce((sum, gold) => sum + gold.categories.length, 0);
  const best = analysis.suggestions[0];
  const bestCard = best ? findCard(best.cardId) : undefined;
  return (
    <ul className={cn("grid gap-3", bestCard ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      <li className={tileClass}>
        <p className={labelClass}>Estimated yearly rewards with your cards</p>
        <p className={figureClass}>{formatWholeDollars(analysis.projection.totalCents)}<span className="text-body font-normal text-secondary">/yr</span></p>
        <p className={noteClass}>Next 12 months, before annual fees. A simulation from your spending profile, not rewards your issuer has credited.</p>
      </li>
      <li className={tileClass}>
        <p className={labelClass}>Cards working for you</p>
        <p className={figureClass}>{analysis.gold.length}</p>
        <p className={noteClass}>Best in {categoriesWon} {categoriesWon === 1 ? "category" : "categories"}</p>
      </li>
      {best && bestCard && (
        <li className="flex">
          <button type="button" onClick={onShowSuggestion} className={cn(tileClass, "ui-transition w-full text-left hover:border-accent-line")}>
            <span className={cn(labelClass, "flex items-center justify-between gap-2")}>
              Best idea <ArrowDown aria-hidden className="size-3.5" strokeWidth={1.75} />
            </span>
            <span className={cn(figureClass, "block text-pos")}>{formatYearlyGain(best.netGainCents)}</span>
            <span className={cn(noteClass, "block")}>Add {brandedName(bestCard)}</span>
          </button>
        </li>
      )}
    </ul>
  );
}

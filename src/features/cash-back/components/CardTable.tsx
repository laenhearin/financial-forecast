"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { Check, Clock, Info, Search, Star, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CARD_CATALOG } from "../cards/catalog";
import { SEARCH_DEBOUNCE_MS } from "../config";
import type { WalletAnalysis } from "../engine/analyze";
import type { GoldCard } from "../engine/rewards";
import { buildTable, topRateChips, type OwnershipFilter, type SortMode } from "../engine/table";
import { brandedName, CATEGORY_SHORT_LABELS, effectiveBps, formatRate, formatWholeDollars, formatYearlyGain } from "../format";
import type { CashBackPrefs } from "../state/prefsStore";
import type { CreditCard, ISODate, SpendProfile } from "../types";
import { CardArt } from "./CardArt";
import { buttonClass, chipClass, ghostButtonClass, goldBadgeClass, panelClass, primaryButtonClass } from "./ui";

const COLUMN_COUNT = 6;
const MAX_BADGE_CATEGORIES = 3;

interface CardTableProps {
  analysis: WalletAnalysis;
  prefs: CashBackPrefs;
  today: ISODate;
  spendProfile: SpendProfile;
  onOpen: (cardId: string) => void;
  onAdd: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  onSort: (sort: SortMode) => void;
  onOwnership: (filter: OwnershipFilter) => void;
  onShowBusiness: (show: boolean) => void;
  className?: string;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 shrink-0 rounded-item border border-app bg-app p-0.5">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "ui-transition rounded-[calc(var(--radius-item)-2px)] px-2.5 text-caption font-medium",
            value === option ? "bg-card text-primary shadow-xs" : "text-secondary hover:text-primary",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** "Best for Dining, Utilities", at most three categories, then "+N". */
function bestForText(gold: GoldCard): string {
  const shown = gold.categories.slice(0, MAX_BADGE_CATEGORIES).map(category => CATEGORY_SHORT_LABELS[category]);
  const extra = gold.categories.length - shown.length;
  return `Best for ${shown.join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
}

/** Gold rows get a 2px outline drawn with inset shadows on the cells, so nothing shifts. */
function goldCellClass(position: "first" | "middle" | "last"): string {
  const edges = {
    first: "shadow-[inset_2px_0_0_var(--gold),inset_0_2px_0_var(--gold),inset_0_-2px_0_var(--gold)]",
    middle: "shadow-[inset_0_2px_0_var(--gold),inset_0_-2px_0_var(--gold)]",
    last: "shadow-[inset_-2px_0_0_var(--gold),inset_0_2px_0_var(--gold),inset_0_-2px_0_var(--gold)]",
  };
  return cn("bg-gold-tint", edges[position]);
}

interface RowProps {
  card: CreditCard;
  owned: boolean;
  gold: GoldCard | undefined;
  analysis: WalletAnalysis;
  today: ISODate;
  spendProfile: SpendProfile;
  selections: CashBackPrefs["selections"];
  onOpen: (cardId: string) => void;
  onAdd: (cardId: string) => void;
  onRemove: (cardId: string) => void;
}

function CardRow({ card, owned, gold, analysis, today, spendProfile, selections, onOpen, onAdd, onRemove }: RowProps) {
  const name = brandedName(card);
  const chips = topRateChips(card, { today, spendProfile, selections });
  const cell = (position: "first" | "middle" | "last", extra?: string) =>
    cn("border-b border-app px-3 py-2.5 align-middle", gold ? goldCellClass(position) : "group-hover:bg-nav-hover", extra);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  const candidate = analysis.candidates.get(card.id);
  const rotatingEnd = card.rotating ? formatDate(card.rotating.endDate, "short") : "";

  return (
    <motion.tr layoutId={card.id} layout="position" onClick={() => onOpen(card.id)} className="group h-16 cursor-pointer">
      <td className={cell("first", "pl-4")}>
        <div className="flex items-center gap-3">
          <CardArt card={card} size="sm" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={event => { stop(event); onOpen(card.id); }}
              aria-label={`${name}, show details`}
              className="rounded-sm text-left text-body font-semibold text-primary underline-offset-4 hover:underline"
            >
              {card.name}
            </button>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-micro text-secondary">{card.issuer}</span>
              {card.isStudent && <span className="rounded-chip bg-rain-soft px-1.5 text-micro font-medium text-primary">Student</span>}
              {card.isBusiness && <span className="rounded-chip bg-app px-1.5 text-micro font-medium text-secondary">Business</span>}
              {owned && gold && (
                <span className={goldBadgeClass}><Star aria-hidden className="size-3 fill-current" />{bestForText(gold)}</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className={cell("middle")}>
        <div className="flex flex-wrap gap-1.5">
          {chips.length === 0 && <span className="text-micro text-secondary">Flat rate</span>}
          {chips.map(chip => {
            const text = `${formatRate(chip.rateBps)} ${CATEGORY_SHORT_LABELS[chip.category]}`;
            if (!chip.rotating) return <span key={chip.category} className={chipClass}>{text}</span>;
            return (
              <Tooltip key={chip.category}>
                <TooltipTrigger
                  onClick={stop}
                  aria-label={`${text}, rotating: ${card.rotating?.quarter}, until ${rotatingEnd}`}
                  className={cn(chipClass, "cursor-help")}
                >
                  <Clock aria-hidden className="size-3" strokeWidth={2} />{text}
                </TooltipTrigger>
                <TooltipContent>{card.rotating?.quarter}, until {rotatingEnd}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </td>
      <td className={cell("middle", "text-body text-primary max-lg:hidden")}>{formatRate(effectiveBps(card.baseRate, card))}</td>
      <td className={cell("middle", "text-body text-primary max-md:hidden")}>
        <span className="inline-flex items-center gap-1">
          {formatUSD(card.annualFeeCents)}
          {card.requiresMembership && (
            <Tooltip>
              <TooltipTrigger onClick={stop} aria-label={`Requires ${card.requiresMembership}`} className="rounded-sm text-secondary hover:text-primary">
                <Info aria-hidden className="size-3.5" strokeWidth={1.75} />
              </TooltipTrigger>
              <TooltipContent>Requires {card.requiresMembership}</TooltipContent>
            </Tooltip>
          )}
        </span>
      </td>
      <td className={cell("middle", "text-body whitespace-nowrap")}>
        {owned ? (
          <span className="text-primary">{formatWholeDollars(analysis.projection.byCard[card.id] ?? 0)}/yr<span className="block text-micro text-secondary">earned</span></span>
        ) : candidate && candidate.netGainCents >= 100 ? (
          <span className="font-semibold text-pos">{formatYearlyGain(candidate.netGainCents)}<span className="block text-micro font-normal text-secondary">if added</span></span>
        ) : (
          <span className="text-secondary"><span aria-hidden>—</span><span className="sr-only">Less than $1 a year</span></span>
        )}
      </td>
      <td className={cell("last", "pr-4 text-right")}>
        {owned ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-6 items-center gap-1 rounded-chip bg-pos-soft px-2 text-micro font-medium whitespace-nowrap text-primary">
              <Check aria-hidden className="size-3" strokeWidth={2.5} /><span className="max-2xl:sr-only">In wallet</span>
            </span>
            <button type="button" className={ghostButtonClass} onClick={event => { stop(event); onRemove(card.id); }} aria-label={`Remove ${name}`}>
              Remove
            </button>
          </span>
        ) : (
          <button type="button" className={primaryButtonClass} onClick={event => { stop(event); onAdd(card.id); }} aria-label={`Add ${name}`}>
            Add
          </button>
        )}
      </td>
    </motion.tr>
  );
}

/** Every catalog card in one table that scrolls inside its own box, about ten rows tall. */
export function CardTable({ analysis, prefs, today, spendProfile, onOpen, onAdd, onRemove, onSort, onOwnership, onShowBusiness, className }: CardTableProps) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const owned = useMemo(() => new Set(prefs.ownedCardIds), [prefs.ownedCardIds]);
  const groups = useMemo(
    () => buildTable(CARD_CATALOG, owned, analysis.gold, { search, sort: prefs.sort, ownership: prefs.ownershipFilter, showBusiness: prefs.showBusiness }),
    [owned, analysis.gold, search, prefs.sort, prefs.ownershipFilter, prefs.showBusiness],
  );
  const goldById = useMemo(() => new Map(analysis.gold.map(gold => [gold.cardId, gold])), [analysis.gold]);

  // A fade at the bottom edge while more rows are hidden below.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const update = () => setMoreBelow(scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1);
    // ResizeObserver also reports once on observe, which sets the first value.
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    scroller.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", update);
    };
  }, [groups]);

  const term = search.trim();
  return (
    <section aria-labelledby="cb-table-title" className={cn(panelClass, "flex flex-col overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-app px-4 py-3">
        <h2 id="cb-table-title" className="mr-1 text-body font-semibold text-primary">All cards</h2>
        <label className="relative flex h-8 min-w-48 flex-1 items-center">
          <span className="sr-only">Search cards</span>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 size-4 text-secondary" strokeWidth={1.75} />
          <input
            type="search"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Search cards, issuers, or categories"
            className="ui-transition h-full w-full rounded-item border border-app bg-card pr-3 pl-8 text-caption text-primary placeholder:text-secondary hover:border-accent-line"
          />
        </label>
        <Segmented label="Sort" value={prefs.sort} options={[["issuer", "Issuer"], ["popularity", "Popularity"]]} onChange={onSort} />
        <Segmented label="Show" value={prefs.ownershipFilter} options={[["all", "All"], ["mine", "My cards"], ["not_owned", "Not owned"]]} onChange={onOwnership} />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-caption text-secondary">
          <input type="checkbox" checked={prefs.showBusiness} onChange={event => onShowBusiness(event.target.checked)} className="size-3.5 accent-(--ac)" />
          Show business cards
        </label>
      </div>

      <div className="relative">
        <motion.div
          ref={scrollRef}
          layoutScroll
          tabIndex={0}
          role="region"
          aria-label="Credit cards"
          className="h-190 max-h-[85dvh] overflow-y-auto overscroll-contain focus-visible:outline-offset-[-2px]"
        >
          {groups.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 px-6 text-center text-body text-secondary">
              {term ? (
                <>
                  <p>No cards match ‘{term}’.</p>
                  <button type="button" className={buttonClass} onClick={() => { setInput(""); setSearch(""); }}>
                    <X aria-hidden className="size-3.5" /> Clear search
                  </button>
                </>
              ) : prefs.ownershipFilter === "mine" ? (
                <p>Add the cards in your wallet to see which one to use.</p>
              ) : (
                <p>No cards to show.</p>
              )}
            </div>
          ) : (
            <MotionConfig reducedMotion="user" transition={{ duration: 0.15, ease: "easeOut" }}>
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    {[
                      ["Card", "pl-4"],
                      ["Top rewards", ""],
                      ["Everything else", "max-lg:hidden"],
                      ["Annual fee", "max-md:hidden"],
                      ["Value to you", ""],
                    ].map(([label, extra]) => (
                      <th key={label} scope="col" className={cn("sticky top-0 z-20 h-10 border-b border-app bg-card px-3 text-micro font-medium whitespace-nowrap text-secondary", extra)}>
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="sticky top-0 z-20 h-10 border-b border-app bg-card pr-4"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                {groups.map(group => (
                  <tbody key={group.id}>
                    {group.label && (
                      <tr>
                        <th
                          scope="rowgroup"
                          colSpan={COLUMN_COUNT}
                          className="sticky top-10 z-10 h-8 border-b border-app bg-app px-4 text-left text-micro font-semibold tracking-wide text-secondary uppercase"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {group.id === "best" && <Star aria-hidden className="size-3 fill-current text-gold" />}
                            {group.label}
                          </span>
                        </th>
                      </tr>
                    )}
                    {group.cards.map(card => (
                      <CardRow
                        key={card.id}
                        card={card}
                        owned={owned.has(card.id)}
                        gold={owned.has(card.id) ? goldById.get(card.id) : undefined}
                        analysis={analysis}
                        today={today}
                        spendProfile={spendProfile}
                        selections={prefs.selections}
                        onOpen={onOpen}
                        onAdd={onAdd}
                        onRemove={onRemove}
                      />
                    ))}
                  </tbody>
                ))}
              </table>
            </MotionConfig>
          )}
        </motion.div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-card to-transparent motion-safe:transition-opacity",
            moreBelow ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </section>
  );
}

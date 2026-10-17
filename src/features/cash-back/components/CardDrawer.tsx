"use client";

import { useState } from "react";
import { Clock, Star } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { findCard } from "../cards/catalog";
import type { WalletAnalysis } from "../engine/analyze";
import { chosenCategories, isValidChoice } from "../engine/rewards";
import {
  brandedName, CATEGORY_LABELS, CATEGORY_SHORT_LABELS, effectiveBps, formatCap, formatEarnRate, formatRate, formatYearlyGain, formatWholeDollars,
  ISSUER_LABELS, joinWords,
} from "../format";
import type { CashBackPrefs } from "../state/prefsStore";
import type { CategoryId, CreditCard, SelectableCategory, SpendCap, SpendProfile } from "../types";
import { CardArt } from "./CardArt";
import { buttonClass, goldBadgeClass, primaryButtonClass } from "./ui";

const sectionTitleClass = "text-caption font-semibold text-primary";
const cellClass = "border-b border-app py-1.5 pr-2 align-top text-caption";

function capText(cap: SpendCap | undefined): string {
  if (!cap) return "No cap";
  return `${formatCap(cap)}${cap.sharedWith?.length ? ", shared" : ""}`;
}

interface DrawerProps {
  cardId: string | null;
  analysis: WalletAnalysis;
  prefs: CashBackPrefs;
  spendProfile: SpendProfile;
  onClose: () => void;
  onAdd: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  onSelect: (cardId: string, choice: CategoryId[]) => void;
}

/** Right-side sheet with a card's full rates, caps, rotating categories, and (for owned choice cards) the category picker. */
export function CardDrawer({ cardId, analysis, prefs, spendProfile, onClose, onAdd, onRemove, onSelect }: DrawerProps) {
  // Keep showing the last card while the sheet animates closed.
  const [shownId, setShownId] = useState(cardId);
  if (cardId && cardId !== shownId) setShownId(cardId);
  const card = shownId ? findCard(shownId) : undefined;

  return (
    <Sheet open={Boolean(cardId && findCard(cardId))} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="gap-0 overflow-y-auto outline-none data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]">
        {card && (
          <DrawerBody card={card} analysis={analysis} prefs={prefs} spendProfile={spendProfile} onAdd={onAdd} onRemove={onRemove} onSelect={onSelect} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ card, analysis, prefs, spendProfile, onAdd, onRemove, onSelect }: Omit<DrawerProps, "cardId" | "onClose"> & { card: CreditCard }) {
  const owned = prefs.ownedCardIds.includes(card.id);
  const name = brandedName(card);
  const wins = owned ? analysis.winners.filter(item => item.winner?.cardId === card.id && item.monthlySpendCents > 0) : [];
  const candidate = analysis.candidates.get(card.id);
  const selectable = card.selectable;
  const chosen = chosenCategories(card, { selections: prefs.selections, spendProfile });

  return (
    <>
      <SheetHeader className="gap-3 border-b border-app px-5 pt-5 pb-4">
        <CardArt card={card} size="lg" className="max-w-full self-center" />
        <div>
          <SheetTitle className="text-lead font-semibold text-primary">{card.fullName}</SheetTitle>
          <SheetDescription className="mt-0.5 text-caption text-secondary">
            {ISSUER_LABELS[card.issuer]} · {card.network} · {card.annualFeeCents > 0 ? `${formatUSD(card.annualFeeCents)} annual fee` : "No annual fee"}
          </SheetDescription>
          {card.requiresMembership && <p className="mt-0.5 text-caption text-secondary">Requires {card.requiresMembership}</p>}
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-5 py-4">
        <section aria-label="Value to you">
          {wins.length > 0 ? (
            <>
              <p className={cn(goldBadgeClass, "h-6 px-2 text-caption")}><Star aria-hidden className="size-3.5 fill-current" />Best for {joinWords(wins.map(item => CATEGORY_SHORT_LABELS[item.category]))}</p>
              <ul className="mt-2 space-y-1 text-caption text-secondary">
                {wins.map(item => {
                  const runnerUp = item.runnerUp && findCard(item.runnerUp.cardId);
                  return (
                    <li key={item.category}>
                      <span className="font-medium text-primary">{CATEGORY_SHORT_LABELS[item.category]}:</span> {formatRate(item.winner!.rateBps)} here
                      {runnerUp && item.runnerUp ? ` vs ${formatRate(item.runnerUp.rateBps)} with ${brandedName(runnerUp)}` : ""}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-caption text-secondary">Earns about {formatWholeDollars(analysis.projection.byCard[card.id] ?? 0)} a year in your wallet.</p>
            </>
          ) : owned ? (
            <p className="text-body text-primary">Earns about {formatWholeDollars(analysis.projection.byCard[card.id] ?? 0)} a year in your wallet. Another card beats it in every category you spend in.</p>
          ) : candidate && candidate.netGainCents >= 100 ? (
            <p className="text-body text-primary">
              <span className="font-semibold text-pos">{formatYearlyGain(candidate.netGainCents)}</span> if added
              {candidate.annualFeeCents > 0 ? `, after the ${formatUSD(candidate.annualFeeCents)} fee` : ""}.
              {candidate.takesOver.length > 0 && <span className="text-secondary"> Takes over {joinWords(candidate.takesOver.map(category => CATEGORY_SHORT_LABELS[category]))}.</span>}
            </p>
          ) : (
            <p className="text-body text-secondary">Wouldn&apos;t add much for your spending{candidate && candidate.annualFeeCents > 0 ? " after its annual fee" : ""}.</p>
          )}
        </section>

        <section aria-labelledby="cb-drawer-rates">
          <h3 id="cb-drawer-rates" className={sectionTitleClass}>Rewards</h3>
          <table className="mt-1.5 w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-micro text-secondary">
                <th scope="col" className="border-b border-app py-1.5 pr-2 font-medium">Category</th>
                <th scope="col" className="border-b border-app py-1.5 pr-2 font-medium">Rate</th>
                <th scope="col" className="border-b border-app py-1.5 pr-2 font-medium">Effective</th>
                <th scope="col" className="border-b border-app py-1.5 font-medium">Cap</th>
              </tr>
            </thead>
            <tbody className="text-primary">
              {card.categoryRules.map(rule => (
                <tr key={rule.category}>
                  <th scope="row" className={cn(cellClass, "font-medium")}>
                    {CATEGORY_LABELS[rule.category]}
                    {rule.note && <span className="block text-micro font-normal text-secondary">{rule.note}</span>}
                  </th>
                  <td className={cellClass}>{formatEarnRate(rule.rate, card)}</td>
                  <td className={cellClass}>{formatRate(effectiveBps(rule.rate, card))}</td>
                  <td className={cn(cellClass, "text-secondary")}>{capText(rule.cap)}</td>
                </tr>
              ))}
              {selectable && (
                <tr>
                  <th scope="row" className={cn(cellClass, "font-medium")}>
                    {selectable.mode === "auto_top_spend" ? "Your top category" : selectable.picks === 1 ? "Your chosen category" : "Your chosen categories"}
                    <span className="block text-micro font-normal text-secondary">Now: {joinWords(chosen.map(category => CATEGORY_SHORT_LABELS[category]))}</span>
                  </th>
                  <td className={cellClass}>{formatEarnRate(selectable.rate, card)}</td>
                  <td className={cellClass}>{formatRate(effectiveBps(selectable.rate, card))}</td>
                  <td className={cn(cellClass, "text-secondary")}>{capText(selectable.cap)}</td>
                </tr>
              )}
              <tr>
                <th scope="row" className={cn(cellClass, "font-medium")}>Everything else</th>
                <td className={cellClass}>{formatEarnRate(card.baseRate, card)}</td>
                <td className={cellClass}>{formatRate(effectiveBps(card.baseRate, card))}</td>
                <td className={cn(cellClass, "text-secondary")}>No cap</td>
              </tr>
            </tbody>
          </table>
          {card.currency !== "cash" && (
            <p className="mt-1.5 text-micro text-secondary">{card.currency === "miles" ? "Miles" : "Points"} are valued at {card.pointValueCents} cent each.</p>
          )}
        </section>

        {card.rotating && (
          <section aria-labelledby="cb-drawer-rotating" className="rounded-item border border-app bg-app px-3.5 py-3">
            <h3 id="cb-drawer-rotating" className={cn(sectionTitleClass, "flex flex-wrap items-center gap-2")}>
              <Clock aria-hidden className="size-3.5" strokeWidth={2} />
              {card.rotating.quarter} rotating categories
              {card.rotating.requiresActivation && <span className="rounded-chip bg-rain-soft px-1.5 text-micro font-medium text-primary">Activation required</span>}
            </h3>
            <p className="mt-1 text-micro text-secondary">
              {formatDate(card.rotating.startDate, "short")} to {formatDate(card.rotating.endDate, "full")} · {card.rotating.label}
            </p>
            <ul className="mt-2 space-y-0.5 text-caption text-primary">
              {(Object.entries(card.rotating.rates) as [CategoryId, number][]).map(([category, rate]) => (
                <li key={category}>{formatEarnRate(rate, card)} {CATEGORY_LABELS[category]}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-micro text-secondary">{capText(card.rotating.cap)} across all rotating categories, then the normal rate.</p>
          </section>
        )}

        {owned && selectable?.mode === "user_choice" && (
          <ChoicePicker
            key={`${card.id}:${chosen.join(",")}`}
            block={selectable}
            current={chosen}
            onSave={choice => onSelect(card.id, choice)}
            earnText={formatEarnRate(selectable.rate, card)}
          />
        )}

        {card.merchantRules && card.merchantRules.length > 0 && (
          <section aria-labelledby="cb-drawer-merchants">
            <h3 id="cb-drawer-merchants" className={sectionTitleClass}>Merchant bonuses</h3>
            <ul className="mt-1.5 space-y-0.5 text-caption text-primary">
              {card.merchantRules.map(rule => <li key={rule.merchant}>{formatEarnRate(rule.rate, card)} {rule.merchant}</li>)}
            </ul>
            <p className="mt-1 text-micro text-secondary">Shown for reference; not counted in the estimates.</p>
          </section>
        )}

        <section aria-labelledby="cb-drawer-highlights">
          <h3 id="cb-drawer-highlights" className={sectionTitleClass}>Highlights</h3>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-caption text-primary">
            {card.highlights.map(highlight => <li key={highlight}>{highlight}</li>)}
          </ul>
        </section>
      </div>

      <SheetFooter className="mt-auto flex-row items-center justify-between border-t border-app px-5 py-3">
        <p className="text-micro text-secondary">Rates last verified {formatDate(card.lastVerified, "full")}</p>
        {owned ? (
          <button type="button" className={buttonClass} onClick={() => onRemove(card.id)} aria-label={`Remove ${name}`}>Remove</button>
        ) : (
          <button type="button" className={primaryButtonClass} onClick={() => onAdd(card.id)} aria-label={`Add ${name}`}>Add to my cards</button>
        )}
      </SheetFooter>
    </>
  );
}

/** Pick the bonus category (or two, for U.S. Bank Cash+). Saving recomputes the whole page. */
function ChoicePicker({ block, current, onSave, earnText }: { block: SelectableCategory; current: CategoryId[]; onSave: (choice: CategoryId[]) => void; earnText: string }) {
  const [draft, setDraft] = useState<CategoryId[]>(current);
  const single = block.picks === 1;
  const changed = draft.length !== current.length || draft.some(category => !current.includes(category));
  const toggle = (category: CategoryId) =>
    setDraft(selected => (single ? [category] : selected.includes(category) ? selected.filter(item => item !== category) : [...selected, category]));

  return (
    <fieldset className="rounded-item border border-app px-3.5 py-3">
      <legend className={cn(sectionTitleClass, "px-1")}>{single ? `Your ${earnText} category` : `Your ${block.picks} ${earnText} categories`}</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
        {block.options.map(category => {
          const checked = draft.includes(category);
          return (
            <label key={category} className="inline-flex cursor-pointer items-center gap-1.5 text-caption text-primary has-disabled:cursor-not-allowed has-disabled:opacity-50">
              <input
                type={single ? "radio" : "checkbox"}
                name="cb-choice"
                checked={checked}
                disabled={!single && !checked && draft.length >= block.picks}
                onChange={() => toggle(category)}
                className="size-3.5 accent-(--ac)"
              />
              {CATEGORY_LABELS[category]}
            </label>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <button type="button" className={primaryButtonClass} disabled={!changed || !isValidChoice(block, draft)} onClick={() => onSave(draft)}>Save</button>
        {!single && <span className="text-micro text-secondary">Choose {block.picks}.</span>}
      </div>
    </fieldset>
  );
}

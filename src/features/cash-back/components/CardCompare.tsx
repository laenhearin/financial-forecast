"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Scale, Sparkles, Star } from "lucide-react";
import type { AiFallbackReason, AiMeta } from "@/lib/ai/types";
import { formatUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { compareFacts, compareTemplate, fetchCompareOverview, selectionsFor, type CompareOverview, type CompareRequest } from "../ai/compare";
import { CARD_CATALOG, findCard } from "../cards/catalog";
import type { WalletAnalysis } from "../engine/analyze";
import { compareCards, MAX_COMPARE_CARDS, type ComparedCard } from "../engine/compare";
import { brandedName, CATEGORY_LABELS, CATEGORY_SHORT_LABELS, formatRate, formatWholeDollars, formatYearlyGain } from "../format";
import type { CashBackPrefs } from "../state/prefsStore";
import { ISSUERS, type CreditCard, type ISODate, type SpendProfile } from "../types";
import { CardArt } from "./CardArt";
import { chipClass, ghostButtonClass, goldBadgeClass, panelClass, primaryButtonClass } from "./ui";

type Slots = (string | null)[];

type OverviewState =
  | { key: string; status: "loading" }
  | { key: string; status: "done"; overview: CompareOverview; meta: AiMeta }
  | { key: string; status: "error"; message: string; overview: CompareOverview };

const selectClass = "ui-transition h-9 w-full min-w-0 rounded-item border border-app bg-card px-2.5 text-body text-primary hover:border-accent-line";

const CARDS_BY_ISSUER = ISSUERS.map(issuer => ({ issuer, cards: CARD_CATALOG.filter(card => card.issuer === issuer) })).filter(group => group.cards.length > 0);

/** Why the overview came from the template, in words. */
const TEMPLATE_REASONS: Record<AiFallbackReason, string> = {
  disabled: "AI is turned off on this server",
  forced: "AI is turned off on this server",
  "no-key": "no Gemini API key is set on the server",
  audit: "the AI answer used a number that didn't match the comparison",
  rate_limited: "the AI service is busy right now",
  billing: "the AI service's billing needs attention",
  timeout: "the AI service took too long to answer",
  auth: "the AI service rejected the API key",
  unavailable: "the AI service couldn't be reached",
  bad_output: "the AI service returned an unreadable answer",
  other: "the AI service couldn't answer",
};

/** Starts with the user's most-used card and the top suggestion, so the panel shows something useful right away. */
function initialSlots(analysis: WalletAnalysis): Slots {
  const first = analysis.gold[0]?.cardId ?? analysis.owned[0]?.id ?? null;
  const second = analysis.suggestions.find(item => item.cardId !== first)?.cardId ?? null;
  return [first, second, null];
}

function signedYearly(cents: number): string {
  return cents > 0 ? formatYearlyGain(cents) : `${formatWholeDollars(cents)}/yr`;
}

interface CardCompareProps {
  analysis: WalletAnalysis;
  prefs: CashBackPrefs;
  spendProfile: SpendProfile;
  today: ISODate;
  onOpen: (cardId: string) => void;
}

/** Up to three catalog cards side by side on the user's own spending, plus an AI overview of which suits them. */
export function CardCompare({ analysis, prefs, spendProfile, today, onOpen }: CardCompareProps) {
  const [slots, setSlots] = useState<Slots>(() => initialSlots(analysis));
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [overview, setOverview] = useState<OverviewState | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const cardIds = useMemo(() => slots.filter((id): id is string => id !== null), [slots]);
  const comparison = useMemo(
    () => compareCards({ cardIds, ownedCardIds: prefs.ownedCardIds, spendProfile, today, selections: prefs.selections }),
    [cardIds, prefs.ownedCardIds, prefs.selections, spendProfile, today],
  );
  const cards = comparison.cards.map(item => ({ item, card: findCard(item.cardId)! }));
  const request: CompareRequest = { cardIds, ownedCardIds: prefs.ownedCardIds, selections: selectionsFor(cardIds, prefs.selections) };
  const requestKey = JSON.stringify(request);
  // An overview belongs to the exact cards and wallet it was written for.
  const current = overview?.key === requestKey ? overview : null;
  const canOverview = cardIds.length >= 2;

  const best = comparison.bestCardId ? findCard(comparison.bestCardId) : undefined;
  const runnerUp = comparison.runnerUpCardId ? findCard(comparison.runnerUpCardId) : undefined;

  function pick(index: number, cardId: string) {
    setSlots(list => list.map((id, at) => (at === index ? cardId || null : id)));
  }

  async function requestOverview() {
    const facts = compareFacts(comparison, spendProfile);
    if (!facts) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const key = requestKey;
    setOverview({ key, status: "loading" });
    try {
      const result = await fetchCompareOverview(request, controller.signal);
      setOverview({ key, status: "done", ...result });
    } catch (error) {
      if (controller.signal.aborted) return;
      setOverview({ key, status: "error", message: error instanceof Error ? error.message : "The overview request failed.", overview: compareTemplate(facts) });
    }
  }

  return (
    <section aria-labelledby="cb-compare-title" className={cn(panelClass, "px-5 py-4")}>
      <h2 id="cb-compare-title" className="flex items-center gap-1.5 text-body font-semibold text-primary">
        <Scale aria-hidden className="size-4 text-accent" strokeWidth={1.75} /> Compare cards
      </h2>
      <p className="mt-0.5 text-caption text-secondary">Pick up to {MAX_COMPARE_CARDS} cards to see which one earns the most on your spending.</p>

      {best && runnerUp && comparison.marginCents !== null && (
        <p className="mt-3 flex items-start gap-1.5 text-body text-primary">
          <Star aria-hidden className="mt-0.5 size-4 shrink-0 fill-gold text-gold" strokeWidth={1.75} />
          <span>
            Best on your spending: <span className="font-semibold">{brandedName(best)}</span>
            {comparison.marginCents > 0
              ? <>, {formatWholeDollars(comparison.marginCents)} a year ahead of {brandedName(runnerUp)} after fees.</>
              : <>, tied with {brandedName(runnerUp)} after fees (the lower fee wins the tie).</>}
          </span>
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {slots.map((slotId, index) => {
          const entry = cards.find(({ card }) => card.id === slotId);
          const taken = new Set(slots.filter((id, at) => id && at !== index));
          return (
            <div
              key={index}
              className={cn(
                "flex min-w-0 flex-col gap-3 rounded-item border p-3.5",
                entry && entry.card.id === comparison.bestCardId ? "border-gold/60 ring-1 ring-gold/60 ring-inset" : "border-app",
              )}
            >
              <div>
                <label htmlFor={`cb-compare-${index}`} className="mb-1 block text-micro font-medium text-secondary">Card {index + 1}</label>
                <select id={`cb-compare-${index}`} value={slotId ?? ""} onChange={event => pick(index, event.target.value)} className={selectClass}>
                  <option value="">Choose a card…</option>
                  {CARDS_BY_ISSUER.map(group => (
                    <optgroup key={group.issuer} label={group.issuer}>
                      {group.cards.map(card => (
                        <option key={card.id} value={card.id} disabled={taken.has(card.id)}>
                          {optionLabel(card, prefs.ownedCardIds)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {entry
                ? <ComparedColumn card={entry.card} item={entry.item} isBest={entry.card.id === comparison.bestCardId} onOpen={onOpen} />
                : <p className="grid min-h-24 flex-1 place-items-center rounded-item border border-dashed border-app px-3 text-center text-caption text-secondary">Pick a card to compare</p>}
            </div>
          );
        })}
      </div>

      {comparison.rows.length > 0 && cards.length > 0 && (
        <>
          <button
            type="button"
            className={cn(ghostButtonClass, "mt-3 -ml-2.5")}
            aria-expanded={showBreakdown}
            aria-controls="cb-compare-breakdown"
            onClick={() => setShowBreakdown(open => !open)}
          >
            Where each card earns
            <ChevronDown aria-hidden className={cn("size-4 motion-safe:transition-transform", showBreakdown && "rotate-180")} strokeWidth={1.75} />
          </button>
          {showBreakdown && (
            <div id="cb-compare-breakdown" className="mt-1 overflow-x-auto">
              <table className="w-full min-w-md text-caption">
                <caption className="sr-only">Yearly rewards by spending category for each compared card</caption>
                <thead>
                  <tr className="text-secondary">
                    <th scope="col" className="py-1.5 pr-3 text-left font-medium">Category</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Spend / mo</th>
                    {cards.map(({ card }) => <th key={card.id} scope="col" className="py-1.5 pl-3 text-right font-medium">{brandedName(card)}</th>)}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {comparison.rows.map(row => (
                    <tr key={row.category} className="border-t border-app">
                      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-primary">{CATEGORY_LABELS[row.category]}</th>
                      <td className="py-1.5 pr-3 text-right text-secondary">{formatWholeDollars(row.monthlySpendCents)}</td>
                      {row.rewardCents.map((cents, at) => {
                        const leads = row.bestCardIds.includes(cards[at].card.id);
                        return (
                          <td key={cards[at].card.id} className={cn("py-1.5 pl-3 text-right", leads ? "font-semibold text-pos" : "text-primary")}>
                            {formatWholeDollars(cents)}{leads && <span className="sr-only"> (earns the most)</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t border-app font-semibold text-primary">
                    <th scope="row" className="py-1.5 pr-3 text-left">Rewards a year</th>
                    <td className="py-1.5 pr-3 text-right text-secondary">{formatWholeDollars(comparison.yearlySpendCents / 12)}</td>
                    {cards.map(({ card, item }) => <td key={card.id} className="py-1.5 pl-3 text-right">{formatWholeDollars(item.yearlyRewardsCents)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <section aria-labelledby="cb-compare-ai-title" className="mt-4 rounded-item border border-accent-line bg-accent-soft px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="cb-compare-ai-title" className="flex items-center gap-1.5 text-caption font-semibold text-primary">
            <Sparkles aria-hidden className="size-4 text-accent" strokeWidth={1.75} />
            {current?.status === "done" && current.meta.source !== "template" ? "AI overview" : "Overview"}
          </h3>
          <button type="button" className={primaryButtonClass} disabled={!canOverview || current?.status === "loading"} onClick={requestOverview}>
            {current?.status === "loading" ? "Writing…" : current ? "Ask again" : "Get AI overview"}
          </button>
        </div>
        <div aria-live="polite" className="mt-2">
          {!canOverview ? (
            <p className="text-caption text-secondary">Pick at least two cards for an overview of which one suits you best.</p>
          ) : !current ? (
            <p className="text-caption text-secondary">Get a plain-language take on which card fits your spending, who each one suits, and what to watch out for.</p>
          ) : current.status === "loading" ? (
            <div aria-busy="true" aria-label="Writing the overview" className="flex flex-col gap-2">
              {["w-2/3", "w-full", "w-5/6"].map(width => <div key={width} className={cn("h-3.5 animate-pulse rounded-item bg-skeleton motion-reduce:animate-none", width)} />)}
            </div>
          ) : (
            <>
              {current.status === "error" && (
                <p role="alert" className="mb-2 text-caption text-neg">Couldn&apos;t get the AI overview: {current.message} Showing the standard overview instead.</p>
              )}
              <OverviewText overview={current.overview} />
              <p className="mt-2 text-micro text-secondary">
                {current.status === "done" && current.meta.source !== "template"
                  ? "Written by AI from the numbers above. AI can make mistakes; the numbers come from the rewards engine."
                  : current.status === "done"
                    ? `From template: ${TEMPLATE_REASONS[current.meta.fallbackReason ?? "other"]}.`
                    : "From template, using the numbers above."}
              </p>
            </>
          )}
        </div>
      </section>

      <p className="mt-3 text-micro text-secondary">
        Estimates from this profile&apos;s monthly spending, as if each card were your only card for a year. Not an offer of credit: approval, APRs, and terms are set by the issuer. If you carry a balance, interest usually costs more than rewards earn.
      </p>
    </section>
  );
}

function optionLabel(card: CreditCard, ownedCardIds: readonly string[]): string {
  const tags = [ownedCardIds.includes(card.id) && "yours", card.isBusiness && "business"].filter(Boolean);
  return tags.length ? `${card.name} (${tags.join(", ")})` : card.name;
}

function OverviewText({ overview }: { overview: CompareOverview }) {
  return (
    <>
      <p className="text-body font-semibold text-primary">{overview.headline}</p>
      <p className="mt-1 text-caption text-primary">{overview.overview}</p>
      {overview.watchOut && <p className="mt-1.5 text-caption text-primary"><span className="font-semibold">Watch out:</span> {overview.watchOut}</p>}
    </>
  );
}

function ComparedColumn({ card, item, isBest, onOpen }: { card: CreditCard; item: ComparedCard; isBest: boolean; onOpen: (cardId: string) => void }) {
  const notes = [
    card.requiresMembership && `Requires ${card.requiresMembership}`,
    card.rotating?.requiresActivation && "Rotating categories need activation",
    card.isBusiness && "Business card",
    card.isStudent && "Student card",
  ].filter((note): note is string => Boolean(note));

  return (
    <>
      <div className="flex items-start gap-3">
        <CardArt card={card} size="sm" />
        <div className="min-w-0">
          <p className="text-body leading-snug font-semibold text-primary">{brandedName(card)}</p>
          {isBest ? <span className={cn(goldBadgeClass, "mt-1")}><Star aria-hidden className="size-3" strokeWidth={2} /> Best for you</span> : <p className="text-micro text-secondary">{card.issuer}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-caption tabular-nums">
        <dt className="text-secondary">Rewards a year</dt>
        <dd className="text-right text-primary">{formatWholeDollars(item.yearlyRewardsCents)}</dd>
        <dt className="text-secondary">Annual fee</dt>
        <dd className="text-right text-primary">{item.annualFeeCents > 0 ? formatUSD(item.annualFeeCents) : "None"}</dd>
        <dt className="font-medium text-primary">After the fee</dt>
        <dd className={cn("text-right text-body font-semibold", item.netCents > 0 ? "text-pos" : item.netCents < 0 ? "text-neg" : "text-primary")}>{formatWholeDollars(item.netCents)}</dd>
        <dt className="text-secondary">Return on spending</dt>
        <dd className="text-right text-primary">{item.returnBps === null ? "No spending" : formatRate(item.returnBps)}</dd>
        <dt className="text-secondary">Added to your cards</dt>
        <dd className="text-right text-primary">{item.addedNetCents === null ? "You have it" : signedYearly(item.addedNetCents)}</dd>
      </dl>
      {item.topCategories.length > 0 && (
        <div>
          <p className="mb-1 text-micro text-secondary">Earns most on</p>
          <ul className="flex flex-wrap gap-1">
            {item.topCategories.map(category => <li key={category} className={chipClass}>{CATEGORY_SHORT_LABELS[category]}</li>)}
          </ul>
        </div>
      )}
      {notes.length > 0 && <ul className="text-micro text-secondary">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
      <button type="button" className={cn(ghostButtonClass, "mt-auto self-start -ml-2.5")} onClick={() => onOpen(card.id)} aria-label={`View ${brandedName(card)} details`}>
        View details
      </button>
    </>
  );
}

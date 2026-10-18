import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { ROUTES } from "@/lib/navigation";
import type { AskState } from "./useAsk";

const DOT_DELAYS_MS = [0, 200, 400];
/** Questions with an amount get a shortcut to the Advisor's full what-if. */
const MENTIONS_AMOUNT = /\$\s?\d|\d+\s?(dollars|bucks)/i;

/** Inline answer under the ask box. Not in the wireframes yet; needs design review. */
export function AnswerCard({ state, onClose }: { state: AskState; onClose: () => void }) {
  const fromTemplate = state.status !== "loading" && state.meta?.source === "template";
  return (
    <div className="relative mt-4 rounded-panel border border-app bg-card px-6 py-5">
      <button
        type="button"
        aria-label="Close answer"
        onClick={onClose}
        className="ui-transition absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-item text-secondary hover:bg-nav-hover hover:text-primary"
      >
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </button>

      <p className="truncate pr-8 text-caption text-secondary">{state.question}</p>

      {state.status === "loading" ? (
        <p className="mt-2 flex items-center gap-1.5 text-lead text-primary">
          {state.checking ? "Checking your forecast" : "Thinking"}
          <span aria-hidden className="inline-flex gap-1">
            {DOT_DELAYS_MS.map((delay) => (
              <span key={delay} className="size-1 animate-pulse rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
        </p>
      ) : (
        <>
          {state.notice && <p className="mt-2 text-caption text-secondary">{state.notice}</p>}
          <p className="mt-2 whitespace-pre-line text-lead text-primary">{state.text}</p>
          {state.status === "answered" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1 text-micro text-secondary">
                <Sparkles aria-hidden className="size-3.5 text-accent" strokeWidth={1.75} />
                {fromTemplate ? "From template, using your forecast" : state.meta ? "AI answer from your forecast" : "Assistant unavailable"}
              </span>
              {state.meta?.auditFlags?.length ? (
                <span role="note" className="text-micro text-secondary">Some dollar figures here didn&apos;t match your forecast. Check them on the calendar.</span>
              ) : null}
              {MENTIONS_AMOUNT.test(state.question) && (
                <Link href={{ pathname: ROUTES.purchaseAdvisor, query: { q: state.question } }} className="jump-link">
                  Open in Purchase advisor <span aria-hidden>→</span>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

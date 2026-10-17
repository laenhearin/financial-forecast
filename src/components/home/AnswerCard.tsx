import Link from "next/link";
import { X } from "lucide-react";
import type { AskAnswer } from "@/lib/ai/ask";
import { ROUTES } from "@/lib/navigation";

export type AnswerState =
  | { status: "loading"; question: string }
  | { status: "answered"; question: string; answer: AskAnswer }
  | { status: "error"; question: string };

const DOT_DELAYS_MS = [0, 200, 400];

/** Inline answer under the ask box. Not in the wireframes yet; needs design review. */
export function AnswerCard({ state, onClose }: { state: AnswerState; onClose: () => void }) {
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

      {state.status === "loading" && (
        <p className="mt-2 flex items-center gap-1.5 text-lead text-primary">
          Thinking
          <span aria-hidden className="inline-flex gap-1">
            {DOT_DELAYS_MS.map((delay) => (
              <span key={delay} className="size-1 animate-pulse rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
        </p>
      )}

      {state.status === "answered" && (
        <>
          <p className="mt-2 text-lead text-primary">{state.answer.text}</p>
          <Link
            href={{ pathname: ROUTES.purchaseAdvisor, query: { q: state.question } }}
            className="mt-3 inline-block text-caption font-medium text-accent hover:underline"
          >
            Open in Purchase advisor
          </Link>
        </>
      )}

      {state.status === "error" && <p className="mt-2 text-lead text-primary">Something went wrong. Try again.</p>}
    </div>
  );
}

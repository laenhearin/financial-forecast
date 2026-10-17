"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { MAX_QUESTION_LENGTH } from "@/lib/ai/validate";
import { AnswerCard } from "./AnswerCard";
import { useAsk } from "./useAsk";

/** Example questions shown before the first one is asked; they double as the demo script. */
const PROMPT_CHIPS = ["Can I afford $300 this Friday?", "What does my week look like?", "How long to save for a $1,200 laptop?"];

/** The AI question box. The answer streams in inline below. */
export function AskBox({ className, defaultCriticalBalanceCents = 0 }: { className?: string; defaultCriticalBalanceCents?: number }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(false);
  const { state, ask, close, busy } = useAsk(defaultCriticalBalanceCents);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setAsked(true);
    setQuestion("");
    void ask(trimmed);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(question);
  }

  function closeAnswer() {
    close();
    inputRef.current?.focus();
  }

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit}
        className="flex min-h-24 flex-1 items-start gap-3 rounded-panel border border-accent-line bg-card px-4 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
      >
        <Sparkles aria-hidden className="size-5 shrink-0 text-accent" strokeWidth={1.75} />
        <textarea
          ref={inputRef}
          rows={2}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={MAX_QUESTION_LENGTH}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Can I afford a $400 flight next Friday?"
          aria-label="Ask a question about your money"
          autoComplete="off"
          className="min-w-0 flex-1 resize-none self-stretch bg-transparent text-lead text-primary outline-none placeholder:text-secondary"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={busy}
          className="ui-transition -my-1.5 -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-item text-accent hover:bg-nav-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowRight aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </form>
      {!asked && (
        <ul aria-label="Example questions" className="mt-3 flex flex-wrap justify-center gap-2.5">
          {PROMPT_CHIPS.map((prompt) => (
            <li key={prompt}>
              <button type="button" onClick={() => submit(prompt)} className="jump-link rounded-full">{prompt}</button>
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite">{state && <AnswerCard state={state} onClose={closeAnswer} />}</div>
    </div>
  );
}

"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { askQuestion } from "@/lib/ai/ask";
import { AnswerCard, type AnswerState } from "./AnswerCard";

/** The AI question box. It only ever talks to askQuestion(); the answer shows inline below. */
export function AskBox({ className }: { className?: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  // A newer question (or closing the card) makes older replies stale.
  const latestRequest = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asked = question.trim();
    if (!asked) return;
    const request = ++latestRequest.current;
    setAnswer({ status: "loading", question: asked });
    setQuestion("");
    try {
      const result = await askQuestion(asked);
      if (request === latestRequest.current) setAnswer({ status: "answered", question: asked, answer: result });
    } catch {
      if (request === latestRequest.current) setAnswer({ status: "error", question: asked });
    }
  }

  function closeAnswer() {
    latestRequest.current++;
    setAnswer(null);
    inputRef.current?.focus();
  }

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 rounded-panel border border-accent-line bg-card px-4 py-3 has-[input:focus]:outline-2 has-[input:focus]:outline-offset-2 has-[input:focus]:outline-accent"
      >
        <Sparkles aria-hidden className="size-5 shrink-0 text-accent" strokeWidth={1.75} />
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Can I afford a $400 flight next Friday?"
          aria-label="Ask a question about your money"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-lead text-primary outline-none placeholder:text-secondary"
        />
        <button
          type="submit"
          aria-label="Ask"
          className="ui-transition -my-1.5 -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-item text-accent hover:bg-nav-hover"
        >
          <ArrowRight aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </form>
      <div aria-live="polite">{answer && <AnswerCard state={answer} onClose={closeAnswer} />}</div>
    </div>
  );
}

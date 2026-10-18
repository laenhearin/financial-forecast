"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eraser, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { MAX_QUESTION_LENGTH } from "@/lib/ai/validate";
import { cn } from "@/lib/utils";
import { NIMBUS_ERRORS, NIMBUS_GREETING, NIMBUS_SIZE, NO_LOOK, POPUP, TEMPLATE_NOTE, UNVERIFIED_NOTE } from "../config";
import { useBlink } from "../hooks/useNimbusBehavior";
import type { useNimbusChat } from "../hooks/useNimbusChat";
import { NimbusSvg } from "./NimbusSvg";

/** Fixed-position placement beside the sidebar, in CSS px. */
export interface PopupPlacement { left: number; bottom: number; maxHeight: number }

const iconButton =
  "ui-transition inline-flex size-8 shrink-0 items-center justify-center rounded-item text-secondary hover:bg-nav-hover hover:text-primary";
const DOT_DELAYS_MS = [0, 200, 400];

function Bubble({ from, note, children }: { from: "user" | "assistant"; note?: string; children: ReactNode }) {
  const mine = from === "user";
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-panel px-3 py-2 text-body break-words whitespace-pre-wrap",
          mine ? "rounded-br-chip bg-primary text-primary-foreground" : "rounded-bl-chip bg-muted text-primary",
        )}
      >
        <span className="sr-only">{mine ? "You: " : "Nimbus: "}</span>
        {children}
        {note && (
          <span className="mt-1.5 flex items-center gap-1 text-micro text-secondary">
            <Sparkles aria-hidden className="size-3.5 text-accent" strokeWidth={1.75} />
            {note}
          </span>
        )}
      </div>
    </li>
  );
}

interface NimbusChatPopupProps {
  id: string;
  placement: PopupPlacement;
  chat: ReturnType<typeof useNimbusChat>;
  reduceMotion: boolean;
  onClose: () => void;
}

/**
 * The chat beside the sidebar. Portaled to <body> so the sidebar never clips it; above page
 * content (z-40) and below dialogs. Only the X button, Escape or Nimbus itself close it.
 */
export function NimbusChatPopup({ id, placement, chat, reduceMotion, onClose }: NimbusChatPopupProps) {
  const { messages, isLoading, error, send, retry, clear } = chat;
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // The header face holds still; only its blink runs (off with reduce motion).
  const blink = useBlink(!reduceMotion);

  // Focus the input when the chat opens and again once each reply arrives.
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, isLoading, error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || !draft.trim()) return;
    send(draft);
    setDraft("");
  }

  return createPortal(
    <section
      id={id}
      role="dialog"
      aria-label="Chat with Nimbus"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      style={{ left: placement.left, bottom: placement.bottom, width: POPUP.width, maxHeight: placement.maxHeight }}
      className="fixed z-40 hidden flex-col overflow-hidden rounded-panel border border-app bg-card text-primary shadow-xl lg:flex"
    >
      <header className="flex items-center gap-3 border-b border-app py-3 pr-3 pl-4">
        <NimbusSvg mood="happy" action="none" look={NO_LOOK} blink={blink} size={NIMBUS_SIZE.header} reduceMotion />
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-primary">Nimbus</h2>
          <p className="text-micro text-secondary">Your money weather buddy</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clear} aria-label="Clear chat" title="Clear chat" className={iconButton}>
            <Eraser aria-hidden className="size-4" strokeWidth={1.75} />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close chat" title="Close chat" className={iconButton}>
          <X aria-hidden className="size-4.5" strokeWidth={1.75} />
        </button>
      </header>

      <ol ref={listRef} aria-live="polite" aria-label="Conversation with Nimbus" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <Bubble from="assistant">{NIMBUS_GREETING}</Bubble>}
        {messages.map((message) => (
          <Bubble key={message.id} from={message.role} note={message.fromTemplate ? TEMPLATE_NOTE : message.unverified ? UNVERIFIED_NOTE : undefined}>
            {message.content}
          </Bubble>
        ))}
        {isLoading && (
          <li className="flex justify-start">
            <div className="flex items-center rounded-panel rounded-bl-chip bg-muted px-3.5 py-3 text-secondary">
              <span className="sr-only">Nimbus is thinking</span>
              <span aria-hidden className="inline-flex gap-1">
                {DOT_DELAYS_MS.map((delay) => (
                  <span key={delay} className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </span>
            </div>
          </li>
        )}
        {error && (
          <li className="flex justify-start">
            <div className="max-w-[85%] rounded-panel rounded-bl-chip bg-muted px-3 py-2 text-body text-primary">
              <span className="sr-only">Nimbus: </span>
              {NIMBUS_ERRORS[error]}
              <button type="button" onClick={retry} className="jump-link mt-2 flex">
                <RotateCcw aria-hidden className="size-3.5" strokeWidth={2} />
                Retry
              </button>
            </div>
          </li>
        )}
      </ol>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-app p-3">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_QUESTION_LENGTH}
          disabled={isLoading}
          placeholder="Ask Nimbus about your money"
          aria-label="Message Nimbus"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-item border border-app px-3 text-body text-primary placeholder:text-secondary disabled:opacity-60"
        />
        <button type="submit" aria-label="Send" disabled={isLoading || !draft.trim()} className={cn(iconButton, "text-accent disabled:cursor-not-allowed disabled:opacity-50")}>
          <SendHorizontal aria-hidden className="size-4.5" strokeWidth={1.75} />
        </button>
      </form>
    </section>,
    document.body,
  );
}

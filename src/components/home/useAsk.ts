"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ASK_UNAVAILABLE_TEXT, streamAsk } from "@/lib/ai/ask";
import type { AiMeta, AskTurn } from "@/lib/ai/types";
import { MAX_HISTORY_TURNS, MAX_TURN_LENGTH } from "@/lib/ai/validate";
import { useActiveCustomerId } from "@/components/layout/ActiveCustomer";
import { purchaseStore } from "@/features/calendar/state/purchaseStore";
import { useCriticalBalance } from "@/features/calendar/state/useCriticalBalance";

export type AskState =
  | { status: "loading"; question: string; checking: boolean }
  | { status: "streaming" | "answered"; question: string; text: string; notice: string | null; meta: AiMeta | null };

/**
 * Ask-box state. Sends the question with the purchases and critical balance this browser keeps,
 * so the server's forecast matches the calendar. Keeps the last few turns in memory only.
 */
export function useAsk(defaultCriticalBalanceCents: number) {
  const [state, setState] = useState<AskState | null>(null);
  const history = useRef<AskTurn[]>([]);
  const controller = useRef<AbortController | null>(null);
  const customerId = useActiveCustomerId();
  const purchases = useSyncExternalStore(purchaseStore.subscribe, () => purchaseStore.getSnapshot(customerId), purchaseStore.getServerSnapshot);
  const criticalBalanceCents = useCriticalBalance(defaultCriticalBalanceCents);

  useEffect(() => () => controller.current?.abort(), []);

  const ask = useCallback(async (question: string) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const live = () => controller.current === current;
    let text = "";
    let notice: string | null = null;
    let meta: AiMeta | null = null;
    setState({ status: "loading", question, checking: false });

    try {
      await streamAsk({ question, history: history.current, criticalBalanceCents, purchases }, (event) => {
        if (!live()) return;
        if (event.type === "tool") setState({ status: "loading", question, checking: true });
        else if (event.type === "text") {
          text += event.delta;
          setState({ status: "streaming", question, text, notice, meta: null });
        } else if (event.type === "error") {
          // Whatever streamed before a failure is replaced by the template overview that follows.
          notice = event.message;
          text = "";
        } else if (event.type === "done") meta = event.meta;
      }, current.signal);
    } catch {
      if (!live() || current.signal.aborted) return;
      setState({ status: "answered", question, text: ASK_UNAVAILABLE_TEXT, notice: null, meta: null });
      return;
    }
    if (!live()) return;
    const answer = text.trim() || ASK_UNAVAILABLE_TEXT;
    setState({ status: "answered", question, text: answer, notice, meta });
    history.current = [...history.current, { role: "user" as const, text: question }, { role: "assistant" as const, text: answer.slice(0, MAX_TURN_LENGTH) }].slice(-MAX_HISTORY_TURNS);
  }, [criticalBalanceCents, purchases]);

  const close = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState(null);
  }, []);

  return { state, ask, close, busy: state?.status === "loading" || state?.status === "streaming" };
}

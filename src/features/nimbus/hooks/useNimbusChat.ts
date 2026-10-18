"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AskHttpError, streamAsk } from "@/lib/ai/ask";
import type { AiMeta } from "@/lib/ai/types";
import { MAX_QUESTION_LENGTH } from "@/lib/ai/validate";
import { balanceSettingsStore } from "@/features/calendar/state/balanceSettingsStore";
import { purchaseStore } from "@/features/calendar/state/purchaseStore";
import type { UserPurchase } from "@/features/calendar/types";
import { NIMBUS_REQUEST_TIMEOUT_MS } from "../config";
import { toAskInput } from "../state/chatHistory";
import { chatStore } from "../state/chatStore";
import type { ChatMessage, NimbusChatError } from "../types";

const NO_PURCHASES: UserPurchase[] = [];

/**
 * Nimbus's conversation, saved in this browser per customer. Asks the same route and grounding as
 * the home ask box (the purchases and critical balance this browser keeps), with source "mascot",
 * and shows each reply once it is complete.
 */
export function useNimbusChat(customerId: string | null) {
  const messages = useSyncExternalStore(chatStore.subscribe, () => chatStore.getSnapshot(customerId), chatStore.getServerSnapshot);
  const purchases = useSyncExternalStore(
    purchaseStore.subscribe,
    () => (customerId ? purchaseStore.getSnapshot(customerId) : NO_PURCHASES),
    purchaseStore.getServerSnapshot,
  );
  // null lets the server use the profile's default, as the ask box does when nothing is saved.
  const criticalBalanceCents = useSyncExternalStore(
    balanceSettingsStore.subscribe,
    () => (customerId ? balanceSettingsStore.getSnapshot(customerId) : null),
    balanceSettingsStore.getServerSnapshot,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NimbusChatError | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const request = useCallback(async (history: ChatMessage[]) => {
    const input = toAskInput(history);
    if (!input) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const live = () => controller.current === current;
    setIsLoading(true);
    setError(null);

    let text = "";
    let failed = false;
    let meta: AiMeta | null = null;
    try {
      await streamAsk(
        { ...input, criticalBalanceCents, purchases, source: "mascot" },
        (event) => {
          if (event.type === "text") text += event.delta;
          else if (event.type === "error") failed = true;
          else if (event.type === "done") meta = event.meta;
        },
        AbortSignal.any([current.signal, AbortSignal.timeout(NIMBUS_REQUEST_TIMEOUT_MS)]),
      );
    } catch (caught) {
      // Aborted by a newer request, Clear chat or unmount: that caller owns the state now.
      if (!live() || current.signal.aborted) return;
      controller.current = null;
      setIsLoading(false);
      setError(caught instanceof AskHttpError && caught.status === 429 ? "busy" : "failed");
      return;
    }
    if (!live()) return;
    controller.current = null;
    setIsLoading(false);
    const reply = text.trim();
    const finished = meta as AiMeta | null;
    // On a model failure the route follows its error with a forecast overview; Nimbus offers Retry instead.
    if (failed || !reply) {
      setError(finished?.fallbackReason === "rate_limited" ? "busy" : "failed");
      return;
    }
    chatStore.append(customerId, { id: crypto.randomUUID(), role: "assistant", content: reply, ts: Date.now(), ...(finished?.source === "template" ? { fromTemplate: true } : {}), ...(finished?.auditFlags?.length ? { unverified: true } : {}) });
  }, [customerId, criticalBalanceCents, purchases]);

  /** Ignores empty input and anything sent while a reply is loading. */
  const send = useCallback((draft: string) => {
    const content = draft.trim().slice(0, MAX_QUESTION_LENGTH);
    if (!content || controller.current) return;
    void request(chatStore.append(customerId, { id: crypto.randomUUID(), role: "user", content, ts: Date.now() }));
  }, [customerId, request]);

  /** Resends the last user message, which is still unanswered after a failure. */
  const retry = useCallback(() => {
    if (!controller.current) void request(chatStore.getSnapshot(customerId));
  }, [customerId, request]);

  const clear = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setIsLoading(false);
    setError(null);
    chatStore.clear(customerId);
  }, [customerId]);

  return { messages, isLoading, error, send, retry, clear };
}

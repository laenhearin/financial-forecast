import type { ChatMessage } from "../types";
import { parseChatHistory, trimHistory } from "./chatHistory";
import { CHAT_STORAGE_KEY, readItem, writeItem } from "./storage";

const EMPTY_HISTORY: ChatMessage[] = [];
let cached: { key: string; value: ChatMessage[] } | null = null;
const listeners = new Set<() => void>();

/** One conversation per Nessie customer id, like the app's other browser state. */
function storageKey(customerId: string | null) {
  return customerId ? `${CHAT_STORAGE_KEY}:${customerId}` : CHAT_STORAGE_KEY;
}

function getSnapshot(customerId: string | null): ChatMessage[] {
  const key = storageKey(customerId);
  if (!cached || cached.key !== key) cached = { key, value: parseChatHistory(readItem(key)) };
  return cached.value;
}

function publish(customerId: string | null, next: ChatMessage[]) {
  const key = storageKey(customerId);
  cached = { key, value: next };
  // If storage refuses, the in-memory history still lasts for this visit.
  writeItem(key, next.length ? JSON.stringify(next) : null);
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key.startsWith(CHAT_STORAGE_KEY)) {
      cached = null;
      listeners.forEach((listener) => listener());
    }
  });
}

export const chatStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot,
  getServerSnapshot(): ChatMessage[] { return EMPTY_HISTORY; },
  /** Appends and returns the stored history (trimmed to the newest messages). */
  append(customerId: string | null, message: ChatMessage): ChatMessage[] {
    const next = trimHistory([...getSnapshot(customerId), message]);
    publish(customerId, next);
    return next;
  },
  clear(customerId: string | null) {
    publish(customerId, EMPTY_HISTORY);
  },
};

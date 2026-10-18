import type { AskTurn } from "@/lib/ai/types";
import { MAX_TURN_LENGTH } from "@/lib/ai/validate";
import { MAX_SENT_MESSAGES, MAX_STORED_MESSAGES } from "../config";
import type { ChatMessage } from "../types";

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ChatMessage>;
  return typeof message.id === "string" && message.id !== ""
    && (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string"
    && typeof message.ts === "number" && Number.isFinite(message.ts)
    && (message.fromTemplate === undefined || typeof message.fromTemplate === "boolean")
    && (message.unverified === undefined || typeof message.unverified === "boolean");
}

/** Saved history, or an empty one when anything about it is invalid. Keeps the newest messages. */
export function parseChatHistory(raw: string | null): ChatMessage[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isChatMessage) ? trimHistory(value) : [];
  } catch {
    return [];
  }
}

/** The newest MAX_STORED_MESSAGES messages. */
export function trimHistory(messages: ChatMessage[], max: number = MAX_STORED_MESSAGES): ChatMessage[] {
  return messages.length > max ? messages.slice(-max) : messages;
}

/** The newest MAX_SENT_MESSAGES messages: all the model sees. */
export function requestWindow(messages: ChatMessage[], max: number = MAX_SENT_MESSAGES): ChatMessage[] {
  return messages.slice(-max);
}

/**
 * Splits a history that ends with the user's message into the ask route's question and earlier
 * turns. Earlier turns start with the user, alternate (a retried or repeated message is merged)
 * and are cut to the route's turn length. Returns null when there is nothing to answer.
 */
export function toAskInput(messages: ChatMessage[]): { question: string; history: AskTurn[] } | null {
  const window = requestWindow(messages);
  const last = window[window.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) return null;
  const history: AskTurn[] = [];
  for (const message of window.slice(0, -1)) {
    const text = message.content.trim();
    if (!text || (history.length === 0 && message.role === "assistant")) continue;
    const previous = history[history.length - 1];
    if (previous?.role === message.role) previous.text = `${previous.text}\n${text}`.slice(0, MAX_TURN_LENGTH);
    else history.push({ role: message.role, text: text.slice(0, MAX_TURN_LENGTH) });
  }
  // The route's question follows the history, so the history must not end on a user turn.
  if (history[history.length - 1]?.role === "user") history.pop();
  return { question: last.content.trim(), history };
}

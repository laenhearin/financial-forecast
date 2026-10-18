import { describe, expect, it } from "vitest";
import { MAX_SENT_MESSAGES, MAX_STORED_MESSAGES } from "../config";
import type { ChatMessage } from "../types";
import { parseChatHistory, requestWindow, toAskInput, trimHistory } from "./chatHistory";
import { parseReduceMotion, readItem, writeItem } from "./storage";

const message = (i: number, role: ChatMessage["role"] = i % 2 ? "assistant" : "user"): ChatMessage =>
  ({ id: `m${i}`, role, content: `message ${i}`, ts: 1_760_000_000_000 + i });
const messages = (count: number) => Array.from({ length: count }, (_, i) => message(i));

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const throwingStorage = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("QuotaExceededError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};

describe("Nimbus storage helpers", () => {
  it("round-trips values and removes on null", () => {
    const storage = memoryStorage();
    expect(writeItem("k", "v", storage)).toBe(true);
    expect(readItem("k", storage)).toBe("v");
    expect(writeItem("k", null, storage)).toBe(true);
    expect(readItem("k", storage)).toBeNull();
  });

  it("survives a throwing or missing localStorage", () => {
    expect(readItem("k", throwingStorage)).toBeNull();
    expect(writeItem("k", "v", throwingStorage)).toBe(false);
    expect(writeItem("k", null, throwingStorage)).toBe(false);
    expect(readItem("k", null)).toBeNull();
    expect(writeItem("k", "v", null)).toBe(false);
  });

  it("reads the reduce motion setting, or null when unset or unknown", () => {
    expect(parseReduceMotion("true")).toBe(true);
    expect(parseReduceMotion("false")).toBe(false);
    expect(parseReduceMotion(null)).toBeNull();
    expect(parseReduceMotion("yes")).toBeNull();
  });
});

describe("Nimbus chat history", () => {
  it("keeps valid history and caps it at the newest stored messages", () => {
    expect(parseChatHistory(JSON.stringify(messages(3)))).toEqual(messages(3));
    const parsed = parseChatHistory(JSON.stringify(messages(MAX_STORED_MESSAGES + 25)));
    expect(parsed).toHaveLength(MAX_STORED_MESSAGES);
    expect(parsed[0].id).toBe("m25");
    expect(trimHistory(messages(MAX_STORED_MESSAGES + 1))).toHaveLength(MAX_STORED_MESSAGES);
  });

  it("discards history that is not a list of valid messages", () => {
    expect(parseChatHistory(null)).toEqual([]);
    expect(parseChatHistory("not json")).toEqual([]);
    expect(parseChatHistory(JSON.stringify({ messages: messages(2) }))).toEqual([]);
    expect(parseChatHistory(JSON.stringify([...messages(2), { ...message(2), role: "system" }]))).toEqual([]);
    expect(parseChatHistory(JSON.stringify([{ ...message(0), content: 42 }]))).toEqual([]);
    expect(parseChatHistory(JSON.stringify([{ ...message(0), id: "" }]))).toEqual([]);
    expect(parseChatHistory(JSON.stringify([{ ...message(0), ts: "today" }]))).toEqual([]);
    expect(parseChatHistory(JSON.stringify([null]))).toEqual([]);
  });

  it("sends only the newest messages", () => {
    const window = requestWindow(messages(MAX_SENT_MESSAGES + 7));
    expect(window).toHaveLength(MAX_SENT_MESSAGES);
    expect(window[0].id).toBe("m7");
  });

  it("turns the window into a question plus alternating earlier turns", () => {
    // 41 messages: the window holds m21 (assistant) through m40 (user).
    const input = toAskInput(messages(41))!;
    expect(input.question).toBe("message 40");
    expect(input.history).toHaveLength(MAX_SENT_MESSAGES - 2);
    expect(input.history[0]).toEqual({ role: "user", text: "message 22" });
    expect(input.history.every((turn, i) => turn.role === (i % 2 ? "assistant" : "user"))).toBe(true);
  });

  it("merges repeated user messages and drops an unanswered one before the question", () => {
    const failedTwice = [message(0, "user"), message(1, "user"), message(2, "assistant"), message(3, "user"), message(4, "user")];
    expect(toAskInput(failedTwice)).toEqual({
      question: "message 4",
      history: [{ role: "user", text: "message 0\nmessage 1" }, { role: "assistant", text: "message 2" }],
    });
    expect(toAskInput([message(0, "user"), message(1, "assistant")])).toBeNull();
    expect(toAskInput([])).toBeNull();
  });
});

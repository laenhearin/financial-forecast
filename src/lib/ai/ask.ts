import type { AskRequest, AskStreamEvent } from "./types";

/** Shown when the ask route can't be reached at all (network down, profile load failed, rate limited). */
export const ASK_UNAVAILABLE_TEXT = "The assistant isn't available right now. Your forecast above is still up to date; try again in a minute.";

/**
 * The only way the UI asks a question. Streams the server's NDJSON events to `onEvent` and resolves
 * when the stream ends. Throws only when the route can't be used; the caller then shows
 * ASK_UNAVAILABLE_TEXT.
 */
export async function streamAsk(request: AskRequest, onEvent: (event: AskStreamEvent) => void, signal?: AbortSignal): Promise<void> {
  if (!request.question.trim()) throw new Error("Question is empty.");
  const response = await fetch("/api/ai/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`Ask failed (${response.status}).`);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffered += value;
    const lines = buffered.split("\n");
    buffered = done ? "" : lines.pop() ?? "";
    for (const line of lines) {
      const event = parseEvent(line);
      if (event) onEvent(event);
    }
    if (done) return;
  }
}

function parseEvent(line: string): AskStreamEvent | null {
  if (!line.trim()) return null;
  try {
    const event = JSON.parse(line) as AskStreamEvent;
    return typeof event === "object" && event !== null && typeof event.type === "string" ? event : null;
  } catch {
    return null;
  }
}

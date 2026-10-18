import "server-only";
import { clientKeyFor, type TokenBucketLimiter } from "./ratelimit";

/** Request bodies for the AI routes are small; anything larger is rejected before parsing. */
export const MAX_AI_BODY_BYTES = 8_192;
/** The ask route also carries Nimbus's 20-message window (up to 500 characters a turn). */
export const MAX_ASK_BODY_BYTES = 24_576;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Browsers send Origin on cross-site POSTs. Reject those so other sites can't spend this app's AI
 * quota through a visitor's browser. Requests without Origin (same-origin GETs, server tools) pass.
 */
export function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host"), new URL(request.url).host];
  return !hosts.some(host => host === originHost);
}

export type BodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

/** Reads a small JSON body. Rejects cross-site requests, other content types, oversized bodies and bad JSON. */
export async function readJsonBody(request: Request, maxBytes = MAX_AI_BODY_BYTES): Promise<BodyResult> {
  if (isCrossOrigin(request)) return { ok: false, response: json({ status: "error", message: "Cross-site requests are not allowed." }, 403) };
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: json({ status: "error", message: "Send JSON." }, 415) };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, response: json({ status: "error", message: "Request is too large." }, 413) };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, response: json({ status: "error", message: "Request is too large." }, 413) };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: json({ status: "error", message: "Request body is not valid JSON." }, 400) };
  }
}

/** 429 with a JSON body; the browser treats it like any other failure and shows template text. */
export function rateLimited(request: Request, limiter: TokenBucketLimiter): Response | null {
  return limiter.take(clientKeyFor(request))
    ? null
    : json({ status: "error", message: "Too many AI requests. Try again in a minute." }, 429);
}

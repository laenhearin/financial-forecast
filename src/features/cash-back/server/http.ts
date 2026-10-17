import "server-only";
import { isCrossOrigin, json, readJsonBody as readLimitedJsonBody, type BodyResult } from "@/lib/ai/server/http";
import { MAX_REQUEST_BYTES } from "../config";

export { isCrossOrigin, json, type BodyResult };

/** Reads a small JSON body. Rejects other content types, oversized bodies, and malformed JSON. */
export function readJsonBody(request: Request): Promise<BodyResult> {
  return readLimitedJsonBody(request, MAX_REQUEST_BYTES);
}

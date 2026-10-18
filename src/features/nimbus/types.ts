/** Nimbus, the sidebar cloud mascot. Types shared by its SVG, behavior hook and chat. */

export type NimbusMood = "happy" | "wandering" | "excited" | "thinking";

/** Idle actions the scheduler picks from. */
export type IdleAction = "wave" | "lookAround" | "wander" | "hop" | "spin" | "stretch";

export type NimbusAction = "none" | IdleAction | "clickSquish";

/** Pupil offset in SVG units, each axis within ±NIMBUS_MAX_LOOK. */
export interface NimbusLook { x: number; y: number }

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Epoch milliseconds. */
  ts: number;
  /** The route answered from its template because AI is off; the bubble is labeled. */
  fromTemplate?: boolean;
}

/** Why the last request failed; each maps to an in-character message. */
export type NimbusChatError = "busy" | "failed";

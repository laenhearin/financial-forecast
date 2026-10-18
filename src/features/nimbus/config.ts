import type { IdleAction, NimbusChatError, NimbusLook } from "./types";

/** Every Nimbus timing, weight, radius, limit and color, in one place. */

export const NIMBUS_SIZE = { default: 88, min: 64, max: 96, header: 40 } as const;

/** One palette for both themes; the Heavy Rain theme only adds NIMBUS_COLORS.glow. */
export const NIMBUS_COLORS = {
  bodyHighlight: "#FFFFFF",
  bodyMid: "#DCEBFF",
  bodyEdge: "#B7CCEE",
  outline: "#9DB8E8",
  ink: "#1E2A4A",
  cheek: "#FFB3C1",
  tongue: "#FF8FA3",
  sparkle: "#FFFFFF",
  glow: "rgba(160, 190, 255, 0.35)",
} as const;

export const IDLE_ACTIONS: Record<IdleAction, { durationMs: number; weight: number }> = {
  wave: { durationMs: 1200, weight: 20 },
  lookAround: { durationMs: 2000, weight: 25 },
  wander: { durationMs: 3000, weight: 25 },
  hop: { durationMs: 800, weight: 15 },
  spin: { durationMs: 900, weight: 5 },
  stretch: { durationMs: 1000, weight: 10 },
};

/** Wait between idle actions. */
export const IDLE_DELAY_MS = { min: 4000, max: 8000 } as const;

export const BLINK = { minDelayMs: 3000, maxDelayMs: 6000, durationMs: 120, doubleChance: 0.2, doubleGapMs: 150 } as const;

/** Cursor distances from Nimbus's center, in CSS pixels. */
export const EXCITE_RADIUS_PX = 140;
export const EXCITE_RELEASE_MS = 600;
export const LOOK_RADIUS_PX = 400;
export const NIMBUS_MAX_LOOK = 3;
export const NO_LOOK: NimbusLook = { x: 0, y: 0 };
export const THINKING_LOOK: NimbusLook = { x: 2.5, y: -2.5 };

/** Squish (120 ms) plus the spring and settle (about 400 ms). */
export const CLICK_REACTION_MS = 520;
/** Share of the free space on one side that a wander may cover. */
export const WANDER_REACH = { min: 0.55, max: 0.9 } as const;

export const MAX_STORED_MESSAGES = 100;
export const MAX_SENT_MESSAGES = 20;
export const NIMBUS_REQUEST_TIMEOUT_MS = 20_000;

export const POPUP = { width: 340, maxHeight: 480, gapPx: 12, edgePx: 16 } as const;

export const NIMBUS_GREETING = "Want to chat about finances?";
export const NIMBUS_ERRORS: Record<NimbusChatError, string> = {
  busy: "Nimbus needs a quick breather. Try again in a moment.",
  failed: "My cloud brain hit a snag. Try again in a moment.",
};
/** Shown under replies the route built from its template because AI is off. */
export const TEMPLATE_NOTE = "From template, using your forecast";

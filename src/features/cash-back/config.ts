import type { WindowDays } from "./types";

export const WINDOW_OPTIONS: WindowDays[] = [30, 90];
export const DEFAULT_WINDOW_DAYS: WindowDays = 90;

/** Annual fees at or above this are "high fee" for the new-card suggestion. */
export const HIGH_FEE_THRESHOLD_CENTS = 25_000;
/** A high-fee card is suggested only if its net yearly value beats the best low-fee card by at least this much. */
export const HIGH_FEE_CLEAR_WIN_CENTS = 10_000;

/** Limits for the AI routes, so a request can't send unbounded text to the model. */
export const MAX_AI_MERCHANTS = 40;
export const MAX_MERCHANT_LENGTH = 80;
export const MAX_REQUEST_BYTES = 16_384;

export const STORAGE_KEY = "cashBack.v1";
export const INPUT_DEBOUNCE_MS = 150;

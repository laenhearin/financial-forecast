/** Limits for the AI categorize route, so a request can't send unbounded text to the model. */
export const MAX_AI_MERCHANTS = 40;
export const MAX_MERCHANT_LENGTH = 80;
export const MAX_REQUEST_BYTES = 16_384;

/** One versioned key holds every Cash Back preference. */
export const STORAGE_KEY = "cashback:v1";
export const SEARCH_DEBOUNCE_MS = 150;

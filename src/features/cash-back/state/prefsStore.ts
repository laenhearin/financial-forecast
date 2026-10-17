import { findCard } from "../cards/library";
import { DEFAULT_WINDOW_DAYS, STORAGE_KEY } from "../config";
import type { WindowDays } from "../types";

export interface CashBackPrefs {
  version: 1;
  /** null means "the cards the data says the customer owns". */
  selectedCardIds: string[] | null;
  windowDays: WindowDays;
  showSuggestion: boolean;
}

export function defaultPrefs(): CashBackPrefs {
  return { version: 1, selectedCardIds: null, windowDays: DEFAULT_WINDOW_DAYS, showSuggestion: true };
}

/** Tolerant parse: anything unexpected falls back to defaults, and unknown card ids are dropped. */
export function parsePrefs(raw: string | null): CashBackPrefs {
  const fallback = defaultPrefs();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Partial<CashBackPrefs>;
    if (value.version !== 1) return fallback;
    const selectedCardIds = Array.isArray(value.selectedCardIds)
      ? [...new Set(value.selectedCardIds.filter((id): id is string => typeof id === "string" && findCard(id) !== undefined))]
      : null;
    return {
      version: 1,
      selectedCardIds,
      windowDays: value.windowDays === 30 || value.windowDays === 90 ? value.windowDays : fallback.windowDays,
      showSuggestion: typeof value.showSuggestion === "boolean" ? value.showSuggestion : fallback.showSuggestion,
    };
  } catch {
    return fallback;
  }
}

/** Adds or removes one card from the selection, starting from `current`. */
export function toggleCard(current: readonly string[], cardId: string): string[] {
  return current.includes(cardId) ? current.filter(id => id !== cardId) : [...current, cardId];
}

/** True when two selections hold the same cards, in any order. */
export function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every(id => b.includes(id));
}

// ---------- Browser store (local storage behind useSyncExternalStore) ----------

let cached: CashBackPrefs | null = null;
const listeners = new Set<() => void>();

function readStorage(): CashBackPrefs {
  try {
    return parsePrefs(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultPrefs();
  }
}

export const prefsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): CashBackPrefs {
    cached ??= readStorage();
    return cached;
  },
  getServerSnapshot(): CashBackPrefs | null {
    return null;
  },
  set(next: CashBackPrefs) {
    cached = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode, quota); the in-memory state still works.
    }
    listeners.forEach(listener => listener());
  },
};

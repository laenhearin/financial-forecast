import { findCard } from "../cards/catalog";
import { STORAGE_KEY } from "../config";
import { DEMO_OWNED_CARD_IDS } from "../data/demoProfile";
import { isValidChoice } from "../engine/rewards";
import type { OwnershipFilter, SortMode } from "../engine/table";
import type { CategoryId } from "../types";

/** Every Cash Back preference, saved under one versioned local storage key. */
export interface CashBackPrefs {
  /** Defaults to the demo customer's cards. */
  ownedCardIds: string[];
  /** user_choice picks per card id. */
  selections: Record<string, CategoryId[]>;
  /** Card ids the user said "Not interested" to. */
  dismissedSuggestions: string[];
  sort: SortMode;
  ownershipFilter: OwnershipFilter;
  showBusiness: boolean;
}

export function defaultPrefs(): CashBackPrefs {
  return {
    ownedCardIds: [...DEMO_OWNED_CARD_IDS],
    selections: {},
    dismissedSuggestions: [],
    sort: "issuer",
    ownershipFilter: "all",
    showBusiness: false,
  };
}

function knownCardIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((id): id is string => typeof id === "string" && findCard(id) !== undefined))];
}

/** Keeps picks only for user_choice cards, and only complete, valid ones. */
function validSelections(value: unknown): Record<string, CategoryId[]> {
  const out: Record<string, CategoryId[]> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return out;
  for (const [cardId, choice] of Object.entries(value)) {
    const block = findCard(cardId)?.selectable;
    if (block?.mode === "user_choice" && Array.isArray(choice) && isValidChoice(block, choice)) out[cardId] = [...choice];
  }
  return out;
}

/** Tolerant parse: anything unexpected falls back to its default, and card ids no longer in the catalog are dropped. */
export function parsePrefs(raw: string | null): CashBackPrefs {
  const fallback = defaultPrefs();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
    return {
      ownedCardIds: knownCardIds(value.ownedCardIds) ?? fallback.ownedCardIds,
      selections: validSelections(value.selections),
      dismissedSuggestions: knownCardIds(value.dismissedSuggestions) ?? [],
      sort: value.sort === "issuer" || value.sort === "popularity" ? value.sort : fallback.sort,
      ownershipFilter: value.ownershipFilter === "all" || value.ownershipFilter === "mine" || value.ownershipFilter === "not_owned"
        ? value.ownershipFilter
        : fallback.ownershipFilter,
      showBusiness: typeof value.showBusiness === "boolean" ? value.showBusiness : fallback.showBusiness,
    };
  } catch {
    return fallback;
  }
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
  /** Client only. Reads local storage once, then serves the cached value. */
  getSnapshot(): CashBackPrefs {
    cached ??= readStorage();
    return cached;
  },
  /** null on the server and during hydration, so nothing renders from local storage too early. */
  getServerSnapshot(): CashBackPrefs | null {
    return null;
  },
  /** Saves on every change; there is no save button. */
  update(change: (current: CashBackPrefs) => CashBackPrefs) {
    cached = change(prefsStore.getSnapshot());
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
      // Storage can be unavailable (private mode, quota); the in-memory state still works.
    }
    listeners.forEach(listener => listener());
  },
};

import { findCard } from "../cards/catalog";
import { STORAGE_KEY } from "../config";
import { isValidChoice } from "../engine/rewards";
import type { OwnershipFilter, SortMode } from "../engine/table";
import type { CategoryId } from "../types";

/** Every Cash Back preference, saved under one versioned local storage key per Nessie customer (cashback:v1.<customerId>). */
export interface CashBackPrefs {
  ownedCardIds: string[];
  /** user_choice picks per card id. */
  selections: Record<string, CategoryId[]>;
  /** Card ids the user said "Not interested" to. */
  dismissedSuggestions: string[];
  sort: SortMode;
  ownershipFilter: OwnershipFilter;
  showBusiness: boolean;
}

/** As saved. ownedCardIds stays null until the user edits their card list, so the cards follow their Nessie credit card accounts. */
export type SavedCashBackPrefs = Omit<CashBackPrefs, "ownedCardIds"> & { ownedCardIds: string[] | null };

export function defaultPrefs(): SavedCashBackPrefs {
  return {
    ownedCardIds: null,
    selections: {},
    dismissedSuggestions: [],
    sort: "issuer",
    ownershipFilter: "all",
    showBusiness: false,
  };
}

/** A saved card list wins once it exists; until then the owned cards are the customer's Nessie card accounts. */
export function resolvePrefs(saved: SavedCashBackPrefs, nessieCardIds: readonly string[]): CashBackPrefs {
  return { ...saved, ownedCardIds: saved.ownedCardIds ?? [...nessieCardIds] };
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
export function parsePrefs(raw: string | null): SavedCashBackPrefs {
  const fallback = defaultPrefs();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
    return {
      ownedCardIds: knownCardIds(value.ownedCardIds),
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

let cached: { key: string; value: SavedCashBackPrefs } | null = null;
const listeners = new Set<() => void>();

/** One saved set per Nessie customer id, as resolved by the server. */
function storageKey(customerId: string): string {
  return `${STORAGE_KEY}.${customerId}`;
}

function readStorage(key: string): SavedCashBackPrefs {
  try {
    return parsePrefs(window.localStorage.getItem(key));
  } catch {
    return defaultPrefs();
  }
}

export const prefsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Client only. Reads local storage once per customer, then serves the cached value. */
  getSnapshot(customerId: string): SavedCashBackPrefs {
    const key = storageKey(customerId);
    if (!cached || cached.key !== key) cached = { key, value: readStorage(key) };
    return cached.value;
  },
  /** null on the server and during hydration, so nothing renders from local storage too early. */
  getServerSnapshot(): SavedCashBackPrefs | null {
    return null;
  },
  /** Saves on every change; there is no save button. One saved set per customer. */
  update(customerId: string, change: (current: SavedCashBackPrefs) => SavedCashBackPrefs) {
    const key = storageKey(customerId);
    const next = change(prefsStore.getSnapshot(customerId));
    cached = { key, value: next };
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode, quota); the in-memory state still works.
    }
    listeners.forEach(listener => listener());
  },
};

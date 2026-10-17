import { isCents } from "@/lib/money";

const STORAGE_KEY = "balance-critical.v1";
let cached: { key: string; value: number | null } | null = null;
const listeners = new Set<() => void>();

/** One saved threshold per Nessie customer id, as resolved by the server. */
function storageKey(customerId: string) {
  return `${STORAGE_KEY}.${customerId}`;
}

function read(key: string): number | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return isCents(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function publish(customerId: string, value: number | null) {
  const key = storageKey(customerId);
  cached = { key, value };
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Keep the in-memory setting if storage is unavailable. */ }
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key?.startsWith(STORAGE_KEY)) {
      cached = null;
      listeners.forEach((listener) => listener());
    }
  });
}

export const balanceSettingsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(customerId: string): number | null {
    const key = storageKey(customerId);
    if (!cached || cached.key !== key) cached = { key, value: read(key) };
    return cached.value;
  },
  getServerSnapshot(): number | null { return null; },
  setCriticalBalanceCents(customerId: string, value: number | null) { publish(customerId, value); },
};

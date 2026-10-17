import { isCents } from "@/lib/money";
import { ACTIVE_PROFILE_STORAGE_KEY } from "@/features/big-purchase/config";

const STORAGE_KEY = "balance-critical.v1";
let cached: { key: string; value: number | null } | null = null;
const listeners = new Set<() => void>();

function storageKey() {
  try {
    return `${STORAGE_KEY}.${window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "college"}`;
  } catch {
    return `${STORAGE_KEY}.college`;
  }
}

function read(key: string): number | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return isCents(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function publish(value: number | null) {
  const key = storageKey();
  cached = { key, value };
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Keep the in-memory setting if storage is unavailable. */ }
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("cloudcash-profile-change", () => {
    cached = null;
    listeners.forEach((listener) => listener());
  });
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
  getSnapshot(): number | null {
    const key = storageKey();
    if (!cached || cached.key !== key) cached = { key, value: read(key) };
    return cached.value;
  },
  getServerSnapshot(): number | null { return null; },
  setCriticalBalanceCents(value: number | null) { publish(value); },
};

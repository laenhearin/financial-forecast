import { isISODate } from "@/lib/dates";
import { isCents } from "@/lib/money";
import { ACTIVE_PROFILE_STORAGE_KEY } from "@/features/big-purchase/config";
import type { UserPurchase } from "../types";

const STORAGE_KEY = "calendar-purchases.v1";
const EMPTY_PURCHASES: UserPurchase[] = [];
let cached: { key: string; value: UserPurchase[] } | null = null;
const listeners = new Set<() => void>();

function storageKey() {
  try {
    return `${STORAGE_KEY}.${window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "college"}`;
  } catch {
    return `${STORAGE_KEY}.college`;
  }
}

function read(key: string): UserPurchase[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is UserPurchase => {
      if (typeof item !== "object" || item === null) return false;
      const purchase = item as Partial<UserPurchase>;
      return typeof purchase.id === "string" && typeof purchase.label === "string"
        && isCents(purchase.amountCents) && purchase.amountCents > 0
        && typeof purchase.date === "string" && isISODate(purchase.date) && typeof purchase.accountId === "string";
    });
  } catch {
    return [];
  }
}

function publish(next: UserPurchase[]) {
  const key = storageKey();
  cached = { key, value: next };
  try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep the in-memory state if storage is unavailable. */ }
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

export const purchaseStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): UserPurchase[] {
    const key = storageKey();
    if (!cached || cached.key !== key) cached = { key, value: read(key) };
    return cached.value;
  },
  getServerSnapshot(): UserPurchase[] { return EMPTY_PURCHASES; },
  add(purchase: Omit<UserPurchase, "id">) {
    publish([...this.getSnapshot(), { ...purchase, id: crypto.randomUUID() }]);
  },
  remove(id: string) {
    publish(this.getSnapshot().filter((purchase) => purchase.id !== id));
  },
};

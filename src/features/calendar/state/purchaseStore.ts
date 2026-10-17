import { isISODate } from "@/lib/dates";
import { isCents } from "@/lib/money";
import { ACTIVE_PROFILE_STORAGE_KEY } from "@/features/big-purchase/config";
import type { ISODate, UserPurchase } from "../types";

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
        && typeof purchase.date === "string" && isISODate(purchase.date) && typeof purchase.accountId === "string"
        && (purchase.recurring === undefined || typeof purchase.recurring === "boolean")
        && (purchase.cancelFromDate === undefined || (typeof purchase.cancelFromDate === "string" && isISODate(purchase.cancelFromDate)))
        && (purchase.skippedDates === undefined || (Array.isArray(purchase.skippedDates) && purchase.skippedDates.every((date) => typeof date === "string" && isISODate(date))));
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

function getSnapshot(): UserPurchase[] {
  const key = storageKey();
  if (!cached || cached.key !== key) cached = { key, value: read(key) };
  return cached.value;
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
  getSnapshot,
  getServerSnapshot(): UserPurchase[] { return EMPTY_PURCHASES; },
  add(purchase: Omit<UserPurchase, "id">) {
    publish([...getSnapshot(), { ...purchase, id: crypto.randomUUID() }]);
  },
  clear() {
    publish([]);
  },
  remove(id: string) {
    publish(getSnapshot().filter((purchase) => purchase.id !== id));
  },
  removeOccurrence(id: string, date: ISODate, deleteFuturePayments: boolean) {
    const existing = getSnapshot().find((purchase) => purchase.id === id);
    if (!existing) return;
    if (!existing.recurring) {
      publish(getSnapshot().filter((purchase) => purchase.id !== id));
      return;
    }
    if (deleteFuturePayments) {
      if (date <= existing.date) {
        publish(getSnapshot().filter((purchase) => purchase.id !== id));
        return;
      }
      publish(getSnapshot().map((purchase) => purchase.id === id
        ? { ...purchase, cancelFromDate: purchase.cancelFromDate && purchase.cancelFromDate < date ? purchase.cancelFromDate : date }
        : purchase));
      return;
    }
    const skippedDates = new Set(existing.skippedDates ?? []);
    skippedDates.add(date);
    publish(getSnapshot().map((purchase) => purchase.id === id ? { ...purchase, skippedDates: [...skippedDates] } : purchase));
  },
};

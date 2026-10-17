import { isISODate } from "@/lib/dates";
import { isCents } from "@/lib/money";
import type { ISODate, UserPurchase } from "../types";

const STORAGE_KEY = "calendar-purchases.v1";
const EMPTY_PURCHASES: UserPurchase[] = [];
let cached: { key: string; value: UserPurchase[] } | null = null;
const listeners = new Set<() => void>();

/** One saved list per Nessie customer id, as resolved by the server. */
function storageKey(customerId: string) {
  return `${STORAGE_KEY}.${customerId}`;
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

function publish(customerId: string, next: UserPurchase[]) {
  const key = storageKey(customerId);
  cached = { key, value: next };
  try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep the in-memory state if storage is unavailable. */ }
  listeners.forEach((listener) => listener());
}

function getSnapshot(customerId: string): UserPurchase[] {
  const key = storageKey(customerId);
  if (!cached || cached.key !== key) cached = { key, value: read(key) };
  return cached.value;
}

if (typeof window !== "undefined") {
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
  add(customerId: string, purchase: Omit<UserPurchase, "id">) {
    publish(customerId, [...getSnapshot(customerId), { ...purchase, id: crypto.randomUUID() }]);
  },
  clear(customerId: string) {
    publish(customerId, []);
  },
  remove(customerId: string, id: string) {
    publish(customerId, getSnapshot(customerId).filter((purchase) => purchase.id !== id));
  },
  removeOccurrence(customerId: string, id: string, date: ISODate, deleteFuturePayments: boolean) {
    const current = getSnapshot(customerId);
    const existing = current.find((purchase) => purchase.id === id);
    if (!existing) return;
    if (!existing.recurring) {
      publish(customerId, current.filter((purchase) => purchase.id !== id));
      return;
    }
    if (deleteFuturePayments) {
      if (date <= existing.date) {
        publish(customerId, current.filter((purchase) => purchase.id !== id));
        return;
      }
      publish(customerId, current.map((purchase) => purchase.id === id
        ? { ...purchase, cancelFromDate: purchase.cancelFromDate && purchase.cancelFromDate < date ? purchase.cancelFromDate : date }
        : purchase));
      return;
    }
    const skippedDates = new Set(existing.skippedDates ?? []);
    skippedDates.add(date);
    publish(customerId, current.map((purchase) => purchase.id === id ? { ...purchase, skippedDates: [...skippedDates] } : purchase));
  },
};

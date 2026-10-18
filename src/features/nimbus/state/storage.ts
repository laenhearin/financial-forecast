/**
 * Safe localStorage access for Nimbus. Every read and write is wrapped, so a blocked or full
 * storage only means the browser keeps state in memory for this visit.
 */

export const CHAT_STORAGE_KEY = "nimbus:chat:v1";
export const REDUCE_MOTION_STORAGE_KEY = "nimbus:reduceMotion";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readItem(key: string, storage: KeyValueStorage | null = browserStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Writes the value, or removes the key for null. Returns false when storage refused. */
export function writeItem(key: string, value: string | null, storage: KeyValueStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** "true" or "false"; anything else means the setting was never saved. */
export function parseReduceMotion(raw: string | null): boolean | null {
  return raw === "true" ? true : raw === "false" ? false : null;
}

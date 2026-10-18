import { parseReduceMotion, readItem, REDUCE_MOTION_STORAGE_KEY, writeItem } from "./storage";

const SYSTEM_QUERY = "(prefers-reduced-motion: reduce)";
/** undefined: not read yet; null: never saved, so the system preference decides. */
let saved: boolean | null | undefined;
const listeners = new Set<() => void>();

function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia(SYSTEM_QUERY).matches;
  } catch {
    return false;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === REDUCE_MOTION_STORAGE_KEY) {
      saved = undefined;
      notify();
    }
  });
}

/** The "Reduce motion" setting: saved in this browser, defaulting to the system preference. */
export const reduceMotionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    let media: MediaQueryList | null = null;
    try {
      media = window.matchMedia(SYSTEM_QUERY);
      media.addEventListener("change", listener);
    } catch { /* No media queries: the saved setting alone decides. */ }
    return () => {
      listeners.delete(listener);
      media?.removeEventListener("change", listener);
    };
  },
  getSnapshot(): boolean {
    if (saved === undefined) saved = parseReduceMotion(readItem(REDUCE_MOTION_STORAGE_KEY));
    return saved ?? systemPrefersReducedMotion();
  },
  /** Still until hydration, so nobody who asked for less motion sees a first frame of it. */
  getServerSnapshot(): boolean { return true; },
  set(value: boolean) {
    saved = value;
    writeItem(REDUCE_MOTION_STORAGE_KEY, String(value));
    notify();
  },
};

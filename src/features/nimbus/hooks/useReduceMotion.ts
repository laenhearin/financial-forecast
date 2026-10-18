"use client";

import { useSyncExternalStore } from "react";
import { reduceMotionStore } from "../state/reduceMotionStore";

/** The shared "Reduce motion" setting. Updates every subscriber at once, including other tabs. */
export function useReduceMotion() {
  const reduceMotion = useSyncExternalStore(reduceMotionStore.subscribe, reduceMotionStore.getSnapshot, reduceMotionStore.getServerSnapshot);
  return { reduceMotion, setReduceMotion: reduceMotionStore.set };
}

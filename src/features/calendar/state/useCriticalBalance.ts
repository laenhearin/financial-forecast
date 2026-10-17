"use client";

import { useSyncExternalStore } from "react";
import { balanceSettingsStore } from "./balanceSettingsStore";

export function useCriticalBalance(defaultCents: number): number {
  const savedCents = useSyncExternalStore(
    balanceSettingsStore.subscribe,
    balanceSettingsStore.getSnapshot,
    balanceSettingsStore.getServerSnapshot,
  );
  return savedCents ?? defaultCents;
}

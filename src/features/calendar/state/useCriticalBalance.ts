"use client";

import { useSyncExternalStore } from "react";
import { useActiveCustomer } from "@/components/layout/ActiveCustomer";
import { balanceSettingsStore } from "./balanceSettingsStore";

/** The active customer's saved threshold, or the default (their housing bill). With no customer loaded, the default. */
export function useCriticalBalance(defaultCents: number): number {
  const customerId = useActiveCustomer()?.id ?? null;
  const savedCents = useSyncExternalStore(
    balanceSettingsStore.subscribe,
    () => (customerId ? balanceSettingsStore.getSnapshot(customerId) : null),
    balanceSettingsStore.getServerSnapshot,
  );
  return savedCents ?? defaultCents;
}

"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The Nessie customer the server resolved (src/lib/active-customer.ts). The shared layout provides it
 * for the shell; each page provides it again from its own data, so anything a page saves in this
 * browser is keyed by the customer whose data that page shows, even when the layout is from an
 * earlier navigation.
 */
export interface ActiveCustomer { id: string; name: string }

const ActiveCustomerContext = createContext<ActiveCustomer | null>(null);
const CHANNEL_NAME = "cloudcash-active-customer";

export function ActiveCustomerProvider({ customer, children }: { customer: ActiveCustomer | null; children: React.ReactNode }) {
  return <ActiveCustomerContext.Provider value={customer}>{children}</ActiveCustomerContext.Provider>;
}

export function useActiveCustomer(): ActiveCustomer | null {
  return useContext(ActiveCustomerContext);
}

/** For components that save per-customer state; they only render inside a page that loaded a customer. */
export function useActiveCustomerId(): string {
  const customer = useContext(ActiveCustomerContext);
  if (!customer) throw new Error("No active Nessie customer. Render this inside a page that loaded one.");
  return customer.id;
}

/** Refreshes this tab's server data when another tab switches the customer. Mounted once, in the layout. */
export function ActiveCustomerSync({ customerId }: { customerId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data !== customerId) router.refresh();
    };
    return () => channel.close();
  }, [customerId, router]);
  return null;
}

/** Call after the server accepted a new customer, so other open tabs reload their data too. */
export function announceCustomerChange(customerId: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(customerId);
  channel.close();
}

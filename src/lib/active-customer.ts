import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { calendarDateInTimeZone } from "./dates";
import { listNessieCustomers, loadCustomerProfile, type CustomerSummary } from "./nessie-profile";

/**
 * The single authority for whose data the app shows. The shared layout, every page, and every API
 * route resolve the customer here, from one httpOnly cookie holding a Nessie customer _id. The
 * browser never decides: it receives the resolved customer from the server (ActiveCustomerProvider)
 * and keys everything it saves locally by that id.
 */
export const ACTIVE_CUSTOMER_COOKIE = "cloudcash-customer";

export const ACTIVE_CUSTOMER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

/** The requested customer when this key can read it; otherwise the first customer Nessie lists. */
export function resolveActiveCustomer(customers: readonly CustomerSummary[], requestedId: string | undefined): CustomerSummary {
  if (customers.length === 0) throw new Error("This Nessie key has no customers yet. Create or seed one first.");
  return customers.find(customer => customer.id === requestedId) ?? customers[0];
}

export const getActiveCustomer = cache(async function getActiveCustomer() {
  const customers = await listNessieCustomers();
  const requested = (await cookies()).get(ACTIVE_CUSTOMER_COOKIE)?.value;
  return { customers, active: resolveActiveCustomer(customers, requested) };
});

/** Today in the app's time zone, read once per request so the layout and page agree. */
export const getAppToday = cache(function getAppToday() {
  return calendarDateInTimeZone(new Date());
});

export const loadActiveProfile = cache(async function loadActiveProfile() {
  const { active } = await getActiveCustomer();
  return loadCustomerProfile(active, getAppToday());
});

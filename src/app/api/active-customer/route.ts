import { NextResponse } from "next/server";
import { ACTIVE_CUSTOMER_COOKIE, ACTIVE_CUSTOMER_COOKIE_OPTIONS } from "@/lib/active-customer";
import { listNessieCustomers } from "@/lib/nessie-profile";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Selects whose Nessie data every page shows. Accepts only customers this server's key can read. */
export async function POST(request: Request) {
  // A JSON content type keeps cross-site form posts from switching the customer.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ message: "Send the customer as JSON." }, { status: 415, headers: NO_STORE });
  }
  let customerId: unknown;
  try {
    customerId = ((await request.json()) as { customerId?: unknown } | null)?.customerId;
  } catch {
    return NextResponse.json({ message: "Choose a customer from the list." }, { status: 400, headers: NO_STORE });
  }
  if (typeof customerId !== "string") {
    return NextResponse.json({ message: "Choose a customer from the list." }, { status: 400, headers: NO_STORE });
  }
  let customers;
  try {
    customers = await listNessieCustomers();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nessie customers could not be loaded.";
    return NextResponse.json({ message }, { status: 503, headers: NO_STORE });
  }
  if (!customers.some(customer => customer.id === customerId)) {
    return NextResponse.json({ message: "Choose a customer from the list." }, { status: 400, headers: NO_STORE });
  }
  const response = NextResponse.json({ activeCustomerId: customerId }, { headers: NO_STORE });
  response.cookies.set(ACTIVE_CUSTOMER_COOKIE, customerId, ACTIVE_CUSTOMER_COOKIE_OPTIONS);
  return response;
}

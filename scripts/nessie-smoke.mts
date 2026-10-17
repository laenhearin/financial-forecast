/** Node-only, read-only probe. Run from the repo root; never import into the app. */
const resources = ["customers", "accounts", "account", "bills", "deposits", "withdrawals", "loans"] as const;
type Resource = (typeof resources)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  // The spec says 24 characters; the production sandbox also returns UUIDs.
  return typeof value === "string" && /^(?:[a-f\d]{24}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(value);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Run from the repo root with Node.js 24:");
    console.log("node --env-file=.env.local scripts/nessie-smoke.mts [resource]");
    console.log(`Resources: ${resources.join(", ")}. Default: accounts.`);
    console.log("Only customers/accounts work without NESSIE_ACCOUNT_ID. Only GET requests are sent.");
    return;
  }

  const selected = args[0] ?? "accounts";
  if (args.length > 1 || !resources.some(resource => resource === selected)) {
    throw new Error("Unknown resource or extra arguments. Run with --help; do not pass keys on the command line.");
  }
  const resource = selected as Resource;
  const key = process.env.NESSIE_API_KEY?.trim();
  if (!key) throw new Error("Set NESSIE_API_KEY in .env.local.");

  // Restrict the destination before adding the secret; do not follow redirects.
  const base = process.env.NESSIE_BASE_URL?.trim().replace(/\/$/, "");
  if (base !== "https://prod-api.nessieisreal.com") {
    throw new Error("Set NESSIE_BASE_URL=https://prod-api.nessieisreal.com in .env.local. This probe only allows that HTTPS host.");
  }
  const needsAccount = resource !== "customers" && resource !== "accounts";
  const accountId = process.env.NESSIE_ACCOUNT_ID?.trim();
  if (needsAccount && !isId(accountId)) {
    throw new Error("Set NESSIE_ACCOUNT_ID to an account _id returned by the accounts probe (24 hexadecimal characters or a UUID).");
  }
  const path = needsAccount
    ? `/accounts/${encodeURIComponent(accountId!)}${resource === "account" ? "" : `/${resource}`}`
    : `/${resource}`;
  const url = new URL(path, base);
  url.searchParams.set("key", key);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Nessie request failed: network, TLS, timeout, or redirect. Check connectivity and retry. Upstream details withheld to protect the key.");
  }
  if (!response.ok) {
    const hints: Record<number, string> = {
      400: "Check the account ID and request parameters.",
      401: "Check the key and its environment; it was not accepted.",
      403: "Check access to this resource with the key owner.",
      404: "Check that this account exists under this key on the production host.",
      429: "Wait before retrying; the service may be rate limiting requests.",
    };
    throw new Error(`Nessie HTTP ${response.status}. ${hints[response.status] ?? "The service could not complete the request; retry later."} Raw response omitted.`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Nessie returned a successful HTTP status but invalid JSON. Connection/schema check failed.");
  }
  const records = resource === "account" ? [data] : data;
  if (!Array.isArray(records) || !records.every(item => isRecord(item) && isId(item._id))) {
    throw new Error("Unexpected response shape: expected records with _id values. Check the current Nessie schema; raw response omitted.");
  }
  if ((resource === "accounts" || resource === "account") && !records.every(item =>
    isRecord(item) && typeof item.nickname === "string" &&
    typeof item.type === "string" && ["Checking", "Savings", "Credit Card"].includes(item.type) &&
    Number.isSafeInteger(item.balance)
  )) {
    throw new Error("Unexpected account fields: expected nickname, documented account type, and integer balance. Update the adapter only after investigating.");
  }

  // Show only IDs, allowlisted account types, and known field types, never raw values/URLs.
  const knownFields = ["_id", "type", "nickname", "balance", "customer_id", "account_id", "status", "payment_amount", "payment_date", "upcoming_payment_date", "recurring_date", "amount", "transaction_date", "medium", "monthly_payment"];
  const first: Record<string, unknown> = records[0] ?? {};
  const fieldTypes = Object.fromEntries(knownFields.filter(field => field in first).map(field => [field,
    first[field] === null ? "null" : Array.isArray(first[field]) ? "array" : typeof first[field],
  ]));
  console.log(JSON.stringify({
    resource,
    httpStatus: response.status,
    count: records.length,
    sample: records.slice(0, 10).map(item => ({
      id: item._id,
      ...((resource === "accounts" || resource === "account") ? { accountType: item.type } : {}),
    })),
    firstRecordFieldTypes: fieldTypes,
    note: records.length ? "Read succeeded. Only a limited shape check was performed; monetary units and forecast semantics are not verified." : "Read succeeded with no records. This is not an authentication failure.",
  }, null, 2));
}

main().catch((error: unknown) => {
  // Only our fixed messages are emitted; never log fetch errors or upstream bodies.
  console.error(error instanceof Error ? error.message : "Nessie probe failed.");
  process.exitCode = 1;
});

/** Node-only HTTP playground. Never import this file into browser code. */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const idPattern = "(?:[a-f\\d]{24}|[a-f\\d]{8}(?:-[a-f\\d]{4}){3}-[a-f\\d]{12})";
const accountPath = new RegExp(`^/accounts/${idPattern}$`, "i");
const billsPath = new RegExp(`^/accounts/${idPattern}/bills$`, "i");
const billPath = new RegExp(`^/bills/${idPattern}$`, "i");
const help = `Run from the repo root with Node.js 24:
node --env-file=.env.local scripts/nessie-playground.mts METHOD PATH [body.json] [--send]

GET    /accounts/{accountId}        Read your configured account
GET    /accounts/{accountId}/bills  List its bills
POST   /accounts/{accountId}/bills  Create a bill using a JSON file
GET    /bills/BILL_ID               Read a bill
PUT    /bills/BILL_ID               Update a bill using a JSON file
DELETE /bills/BILL_ID               Delete that bill

{accountId} is replaced with NESSIE_ACCOUNT_ID. Replace BILL_ID with a returned _id.
GET sends immediately. POST/PUT/DELETE only preview unless --send is present.
Writes affect the shared Nessie sandbox. Use your own test bill, then clean it up.
See API-guide.md for the complete create/read/update/delete walkthrough.`;

function redact(value: unknown, key: string): unknown {
  const json = JSON.stringify(value, (field, item: unknown) => {
    if (/^(?:key|api_key|apiKey|account_number)$/i.test(field)) return "[redacted]";
    if (typeof item !== "string") return item;
    return (key ? item.split(key).join("[redacted]") : item)
      .replace(/([?&]key=)[^&\s"']+/gi, "$1[redacted]");
  });
  return JSON.parse(json);
}

export async function runPlayground(args: string[]): Promise<unknown> {
  const send = args.includes("--send");
  const positional = args.filter(arg => arg !== "--send");
  const [methodInput, inputPath, bodyFile] = positional;
  const method = methodInput?.toUpperCase();
  if (positional.length < 2 || positional.length > 3 || args.filter(arg => arg === "--send").length > 1) {
    throw new Error("Use METHOD PATH [body.json] [--send]. Run with --help for examples.");
  }
  const path = inputPath.replaceAll("{accountId}", process.env.NESSIE_ACCOUNT_ID?.trim() ?? "");
  const allowed = (method === "GET" && (accountPath.test(path) || billsPath.test(path) || billPath.test(path))) ||
    (method === "POST" && billsPath.test(path)) ||
    ((method === "PUT" || method === "DELETE") && billPath.test(path));
  if (!allowed) throw new Error("Unsupported method/path or missing ID. This playground only supports the account and bill operations listed in --help.");
  if (process.env.NESSIE_BASE_URL?.trim().replace(/\/$/, "") !== "https://prod-api.nessieisreal.com") {
    throw new Error("Set NESSIE_BASE_URL=https://prod-api.nessieisreal.com in .env.local.");
  }

  const needsBody = method === "POST" || method === "PUT";
  if (needsBody !== Boolean(bodyFile)) throw new Error("POST/PUT require one JSON body file. GET/DELETE must not include a body file.");
  let body: unknown;
  if (bodyFile) {
    try { body = JSON.parse(await readFile(bodyFile, "utf8")); }
    catch { throw new Error("Could not read a valid JSON body file. Check its path and JSON syntax."); }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("The request body must be a JSON object matching BillCreate or BillUpdate in the official docs.");
    }
  }

  const key = process.env.NESSIE_API_KEY?.trim() ?? "";
  if (method !== "GET" && !send) {
    return redact({ preview: true, method, path, body, message: "No request sent. Add --send to make this change in the shared Nessie sandbox." }, key);
  }
  if (!key) throw new Error("Set NESSIE_API_KEY in .env.local.");
  const url = new URL(path, "https://prod-api.nessieisreal.com");
  url.searchParams.set("key", key);
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...(needsBody ? { "Content-Type": "application/json" } : {}) },
      ...(needsBody ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }
    text = await response.text();
  } catch (error: unknown) {
    if (error instanceof Error && /^HTTP_\d{3}$/.test(error.message)) {
      throw new Error(`Nessie HTTP ${error.message.slice(5)}. Check access, resource ID, and the documented request fields. Raw upstream details omitted.`);
    }
    throw new Error("Nessie network/timeout/redirect failure. Raw details omitted. Before retrying a write, GET the bills to check whether it already took effect.");
  }
  let data: unknown = null;
  if (text.trim()) {
    try { data = JSON.parse(text); }
    catch { throw new Error("Nessie returned success but a non-JSON body. Re-read the resource before retrying a write; raw body omitted."); }
  }
  return redact({ method, path, httpStatus: response.status, data }, key);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--help")) {
    console.log(help);
  } else {
    runPlayground(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Nessie playground failed.");
      process.exitCode = 1;
    });
  }
}

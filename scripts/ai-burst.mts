/**
 * Fires N AI requests in a short window through the running app to find where the free tier starts
 * returning 429 (rate_limited). Each request uses a different amount so the cache can't answer it.
 *
 * THIS CONSUMES FREE-TIER QUOTA. Gemini quota is shared per Google Cloud project and resets at
 * midnight Pacific; run it once, before demo day, to decide whether to enable billing.
 *
 *   npm run ai:burst                              # 20 advisor requests
 *   npm run ai:burst -- --count 40 --surface ask
 *   npm run ai:burst -- --base http://localhost:3001
 *
 * The app's own route limit (AI_ROUTE_RATE_LIMIT_PER_MIN, default 30) answers with HTTP 429 before
 * Gemini is called; raise it on the server for bursts larger than that.
 */
type Meta = { source: string; model?: string; latencyMs: number; fallbackReason?: string };

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const base = option("base", process.env.AI_SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const count = Number(option("count", "20"));
const surface = option("surface", "advisor");
if (!Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error("--count must be 1 to 200.");
if (surface !== "advisor" && surface !== "ask") throw new Error("--surface must be advisor or ask.");

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

async function one(index: number, asOfDate: string, accountId: string): Promise<{ index: number; status: number; meta?: Meta; ms: number }> {
  const started = performance.now();
  const amountCents = 10_000 + index * 137; // distinct facts, so no cache hits
  const body = surface === "advisor"
    ? { purchase: { label: "Burst test", amountCents, date: addDays(asOfDate, 2), accountId } }
    : { question: `Can I afford $${(amountCents / 100).toFixed(2)} on ${addDays(asOfDate, 2)}?` };
  const response = await fetch(`${base}/api/ai/${surface}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  let meta: Meta | undefined;
  try {
    if (surface === "advisor") meta = (JSON.parse(text) as { meta?: Meta }).meta;
    else meta = text.trim().split("\n").map((line) => JSON.parse(line) as { type: string; meta?: Meta }).find((event) => event.type === "done")?.meta;
  } catch { /* non-JSON body: keep the status only */ }
  return { index, status: response.status, meta, ms: Math.round(performance.now() - started) };
}

async function main() {
  console.warn(`WARNING: this sends ${count} ${surface} requests that consume shared Gemini free-tier quota.\n`);
  const demo = await fetch(`${base}/api/demo-data`, { cache: "no-store" });
  if (!demo.ok) throw new Error(`GET /api/demo-data returned ${demo.status}. Is the app running at ${base}?`);
  const { scenario } = await demo.json() as { scenario: { asOfDate: string; accounts: Array<{ id: string }> } };

  // Small concurrent batches keep the window short without opening hundreds of sockets at once.
  const results: Awaited<ReturnType<typeof one>>[] = [];
  for (let start = 0; start < count; start += 5) {
    const batch = Array.from({ length: Math.min(5, count - start) }, (_, offset) => one(start + offset + 1, scenario.asOfDate, scenario.accounts[0].id));
    results.push(...await Promise.all(batch));
  }

  console.log("  #  http  source    model                      fallback       latency");
  for (const result of results) {
    console.log(`${String(result.index).padStart(3)}  ${String(result.status).padEnd(4)}  ${(result.meta?.source ?? "-").padEnd(8)}  ${(result.meta?.model ?? "-").padEnd(25)}  ${(result.meta?.fallbackReason ?? "-").padEnd(13)}  ${result.ms}ms`);
  }
  const firstLimited = results.find((result) => result.meta?.fallbackReason === "rate_limited");
  const routeLimited = results.filter((result) => result.status === 429).length;
  const models = results.filter((result) => result.meta?.source === "model").length;
  console.log(`\n${models}/${count} answered by a model.`);
  console.log(firstLimited ? `First Gemini rate limit (after the fallback model was also tried) at request #${firstLimited.index}.` : "No Gemini rate limit seen in this burst.");
  if (routeLimited) console.log(`${routeLimited} requests hit the app's own route limit (HTTP 429).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Burst test crashed.");
  process.exitCode = 1;
});

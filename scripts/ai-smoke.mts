/**
 * Live end-to-end check of every AI surface through the running app (start it first with
 * `npm run dev` or `npm start`). Prints source, model, latency and audit flags, then PASS/FAIL.
 *
 *   npm run ai:smoke                         # expects model answers (server has GEMINI_API_KEY)
 *   npm run ai:smoke -- --expect template    # server started with AI_FORCE_FALLBACK=true or no key
 *   npm run ai:smoke -- --base http://localhost:3001
 *
 * Read-only: it never writes to Nessie. With a key it spends a few requests of free-tier quota.
 */
type Meta = { source: string; model?: string; latencyMs: number; auditFlags?: string[]; fallbackReason?: string };
type Result = { surface: string; ok: boolean; meta?: Meta; detail: string };

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const base = option("base", process.env.AI_SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const expect = option("expect", "model");
if (!["model", "template", "any"].includes(expect)) throw new Error("--expect must be model, template or any.");

const sourceOk = (meta: Meta | undefined) =>
  !!meta && (expect === "any" || (expect === "model" ? meta.source === "model" || meta.source === "cache" : meta.source === "template"));

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/** Parses a JSON body, naming the route and status when it isn't JSON. */
async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${response.url} returned HTTP ${response.status} with a non-JSON body: ${text.slice(0, 120) || "(empty)"}`);
  }
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  const demo = await fetch(`${base}/api/dashboard`, { cache: "no-store" });
  if (!demo.ok) throw new Error(`GET /api/dashboard returned ${demo.status}. Is the app running at ${base} with Nessie configured?`);
  const scenario = await readJson<{ asOfDate: string; accounts: Array<{ id: string }> }>(demo);
  if (!scenario.accounts[0]?.id) throw new Error("The selected Nessie customer has no cash account for the smoke test.");
  // Hypothetical test inputs, not a goal returned by Nessie or written to browser storage.
  const goal = { name: "Smoke test laptop", costCents: 120_000, bufferCents: 20_000, contributionCents: null, preferredDeadline: null };
  const results: Result[] = [];

  // B: Purchase Advisor explanation.
  {
    const response = await post("/api/ai/advisor", { purchase: { label: "Headphones", amountCents: 40_000, date: addDays(scenario.asOfDate, 3), accountId: scenario.accounts[0].id } });
    const body = await readJson<{ explanation?: { headline: string; explanation: string }; meta?: Meta; message?: string }>(response);
    const ok = response.ok && !!body.explanation?.explanation && sourceOk(body.meta);
    results.push({ surface: "advisor", ok, meta: body.meta, detail: body.explanation ? `${body.explanation.headline} | ${body.explanation.explanation}` : `HTTP ${response.status} ${body.message ?? ""}` });
  }

  // C: Big Purchase summary.
  {
    const response = await post("/api/ai/goal-summary", { goal: { name: goal.name, costCents: goal.costCents, bufferCents: goal.bufferCents, contributionCents: goal.contributionCents, deadline: goal.preferredDeadline } });
    const body = await readJson<{ summary?: string; meta?: Meta; message?: string }>(response);
    results.push({ surface: "goal-summary", ok: response.ok && !!body.summary && sourceOk(body.meta), meta: body.meta, detail: body.summary ?? `HTTP ${response.status} ${body.message ?? ""}` });
  }

  // A: Ask box, a what-if that should call checkPurchase.
  {
    const response = await post("/api/ai/ask", { question: "Can I afford $300 this Friday?" });
    if (!response.ok) {
      results.push({ surface: "ask", ok: false, detail: `HTTP ${response.status} ${await response.text()}` });
    } else {
      const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line) as { type: string; name?: string; delta?: string; meta?: Meta; message?: string });
      const text = events.filter((event) => event.type === "text").map((event) => event.delta).join("");
      const tools = events.filter((event) => event.type === "tool").map((event) => event.name);
      const done = events.find((event) => event.type === "done");
      const ok = !!text && !!done && sourceOk(done.meta) && (expect !== "model" || done.meta?.source === "cache" || tools.length > 0);
      results.push({ surface: "ask", ok, meta: done?.meta, detail: `${tools.length ? `[tools: ${tools.join(", ")}] ` : ""}${text}` });
    }
  }

  console.log(`AI smoke test against ${base} (expecting ${expect})\n`);
  for (const result of results) {
    const meta = result.meta;
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.surface.padEnd(13)} source=${meta?.source ?? "-"} model=${meta?.model ?? "-"} latency=${meta?.latencyMs ?? "-"}ms`
      + `${meta?.fallbackReason ? ` fallback=${meta.fallbackReason}` : ""}${meta?.auditFlags?.length ? ` audit=${meta.auditFlags.join("; ")}` : ""}`);
    console.log(`      ${result.detail.slice(0, 400)}\n`);
  }
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`FAIL  ${error instanceof Error ? error.message : "smoke test crashed"}`);
  process.exitCode = 1;
});

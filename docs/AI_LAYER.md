# AI layer (Gemini)

The forecast engine computes financial results. The model explains those facts and converses; it
receives JSON from deterministic TypeScript rather than calculating balances itself. Validation and
fallbacks reduce unsupported output, but do not prove every date, number or sentence in model prose correct.

## Surfaces

| Surface | Where | Route | Model (env) | Output |
| --- | --- | --- | --- | --- |
| Ask box | Home page | `POST /api/ai/ask` | `GEMINI_MODEL_MAIN` | Read-only tool progress, then an audited answer (NDJSON) |
| Nimbus chat | Sidebar mascot, every page (1024px+) | `POST /api/ai/ask` with `source: "mascot"` | `GEMINI_MODEL_MAIN` | Same as the ask box; the browser shows the reply once complete |
| Purchase explanation | Purchase Advisor | `POST /api/ai/advisor` | `GEMINI_MODEL_FAST` | Structured JSON: headline, explanation, alternative |
| Goal summary | Big Purchase, "Help me get there" | `POST /api/ai/goal-summary` | `GEMINI_MODEL_FAST` | Structured JSON: summary |
| Merchant categories | Cash Back | `POST /api/cash-back/categorize` | `GEMINI_MODEL_FAST` | Structured JSON: category per merchant |
| Card comparison overview | Swipe and Shine, "Compare cards" | `POST /api/cash-back/compare` | `GEMINI_MODEL_FAST` | Structured JSON: headline, overview, watchOut |

The browser sends **inputs only** (a purchase, goal fields, the critical balance and purchases it keeps
in localStorage). The server reloads the active demo profile and recomputes the facts with the same
engine functions the pages use, so the model never sees client-made numbers. The ask box's
`checkPurchase` tool and the Purchase Advisor page both call `checkPurchase()` in
`src/features/calendar/engine/purchaseCheck.ts`, so the tool's numerical verdict matches the page.
Model wording can still misinterpret it; the deterministic verdict remains authoritative.

Nimbus (`src/features/nimbus/`) reuses the ask route rather than a second pipeline. `source: "mascot"`
appends its persona (`src/lib/ai/prompts/system-mascot.ts`) to the ask instructions, keeps up to 19
earlier turns instead of 4, and caches its answers apart from the ask box's. Its conversation is saved
in localStorage per customer (`nimbus:chat:v1:<customerId>`, newest 100 messages; the newest 20 are sent).

Verdicts use the app's six balance levels (THRIVING, STABLE, CAUTION, NEAR CRITICAL, CRITICAL,
BELOW $0) against the user's critical balance, which defaults to their rent.

## Setup

1. Create a key at https://aistudio.google.com/apikey.
2. Put it in `.env.local` as `GEMINI_API_KEY=...` (see `.env.example` for every variable). Never use a
   `NEXT_PUBLIC_` prefix and never commit `.env.local`.
3. On Vercel, add the same variables under Project Settings → Environment Variables for Production
   and Preview. The routes run on the Node.js runtime.

A configured key is not a verified connection. Run `npm run ai:smoke` (below) to check it.

## How fallback works

Every surface goes through one policy (`src/lib/ai/server/generate.ts`, and `ask.ts` for the stream):

1. `AI_ENABLED=false`, `AI_FORCE_FALLBACK=true`, or no key: template text, no API call.
2. Cache hit (in-memory, `AI_CACHE_TTL_MS`): replay it.
3. Call the surface's model, bounded by `AI_REQUEST_TIMEOUT_MS`.
4. Rate limited, unavailable, or unusable output: one retry on `GEMINI_MODEL_FALLBACK` (or the same
   model after about 800 ms when they are the same).
5. Timeout, invalid key, or a second failure: template text.
6. Success: validate, run the number audit, cache, return.

Templates (`src/lib/ai/fallbacks.ts`) are built from the same facts and read as normal product
copy. The UI labels each answer "AI ..." or "From template", and never shows a blank panel or raw
error. Each response carries `meta: { source, model, latencyMs, fallbackReason?, auditFlags? }`.

**Number audit** (`src/lib/ai/audit.ts`): every money amount in model text ("$1,234.56", "$15k",
"1,234 dollars", "USD 1,234") must match a number in the facts (within $0.50). For the Advisor and goal
summary and the ask answer, a failed audit swaps in the template. Ask/Nimbus tool progress streams
immediately, but answer text is held until its audit passes; rejected or partial model answers are
never displayed or cached. Ask cache keys include the full customer's financial context and saved
purchases, so a matching short baseline cannot reuse another customer's or an outdated later forecast's answer.

Savings plans with a negative cash day use a deterministic goal-summary warning without calling the
model. The goal timeline tool returns no affordable date for such plans and includes the first shortfall.

What it does not do: it does not check percentages, day counts, or dates, and it only checks that a
figure exists somewhere in the facts, not that it is attached to the right thing (calling the $1,800
rent the purchase price passes). It reduces unsupported numbers; it does not prove an explanation correct.

**Force the fallback path:** set `AI_FORCE_FALLBACK=true` and restart the server.

## Scripts

Both scripts call the running app over HTTP. Start it first (`npm run dev`, or `npm run build` then
`npm start`).

- `npm run ai:smoke` runs one request through the advisor, goal-summary and ask routes and prints
  source, model, latency, audit flags and PASS/FAIL. It exits non-zero on failure. Use
  `npm run ai:smoke -- --expect template` against a server started with `AI_FORCE_FALLBACK=true` (or no
  key), and `--base http://localhost:3001` for another port.
- `npm run ai:burst` sends 20 (or `--count N`) uncached advisor (or `--surface ask`) requests and
  prints status, source and latency per request plus the first rate limit seen. **It consumes
  free-tier quota.** The app's own limit (`AI_ROUTE_RATE_LIMIT_PER_MIN`, default 30) answers 429
  first, so raise it on the server for larger bursts.

## Free tier caveats

- Quota is shared per Google Cloud project (everyone on the team using one key shares it) and resets
  daily at midnight Pacific. Exact per-model limits are on AI Studio's rate-limit page.
- On the free tier Google may use prompts and responses to improve its products. The demo sends only
  seeded synthetic data, and prompts never include customer names or account ids. Real user data must
  not go through the free tier; enabling billing turns that use off.
- The ask box chains tool rounds with `previous_interaction_id`, which relies on Gemini storing those
  interactions. The one-shot surfaces send `store: false`.
- The cache and rate limiter are in memory, so on Vercel each serverless instance has its own.

## Troubleshooting

When an answer says "From template" (or the ask box says it couldn't reach the assistant), the
server log has a line starting with `[ai <id>]` that includes Google's own reason.

- **Billing problem / HTTP 402 "Your prepayment credits are depleted":** the key's project uses
  prepaid billing and has no credit left. Every model fails, so the fallback model can't help. Add
  credit at https://ai.studio/projects, or use a key from a project on the free tier.
- **Rate limited / HTTP 429:** free-tier quota for that model is used up. The app retries once on
  `GEMINI_MODEL_FALLBACK`; quota resets at midnight Pacific.
- **HTTP 403:** the project can't use that model. The app retries on the fallback model; set
  `GEMINI_MODEL_MAIN` to a model the project can use.
- **"Gemini rejected the API key":** the key is wrong or revoked. Check `GEMINI_API_KEY` and restart.

## Adding a surface

Add a prompt in `src/lib/ai/prompts/`, a facts builder in `src/lib/ai/facts/`, a schema and
validator in `schemas.ts`, a template in `fallbacks.ts`, and a handler that calls
`generateStructured()`. Read-only ask-box tools (for example a Storm Solver plan or the best card
for a category) are appended to `TOOL_DECLARATIONS` and `HANDLERS` in `src/lib/ai/server/tools.ts`.

## Security

- `GEMINI_API_KEY` is read only in `src/lib/ai/server/config.ts`. Every module under
  `src/lib/ai/server/` imports `server-only`, and `src/lib/ai/keyIsolation.test.ts` fails if a client
  module imports the server AI layer or the SDK.
- User questions, labels and tool results are untrusted. They are passed as delimited data, and the
  prompts say to ignore instructions inside them. No tool can write, transfer or pay; the blast radius
  of a prompt injection is wording only.
- Request bodies are capped (8 KB for AI routes), validated field by field with unknown keys
  rejected, and rate limited per client IP. Cross-site POSTs are refused.
- Clients only ever see fixed, friendly messages. Server logs carry a request id and an error kind,
  never the key or prompt bodies.

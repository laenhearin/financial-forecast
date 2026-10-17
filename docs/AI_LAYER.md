# AI layer (Gemini)

The forecast engine computes every number. The model only explains, advises and converses. Every
dollar figure, date and balance level a user sees comes from deterministic TypeScript; the model
gets those facts as JSON and writes the words around them.

## Surfaces

| Surface | Where | Route | Model (env) | Output |
| --- | --- | --- | --- | --- |
| Ask box | Home page | `POST /api/ai/ask` | `GEMINI_MODEL_MAIN` | Read-only tool calls, then streamed text (NDJSON) |
| Purchase explanation | Purchase Advisor | `POST /api/ai/advisor` | `GEMINI_MODEL_FAST` | Structured JSON: headline, explanation, alternative |
| Goal summary | Big Purchase, "Help me get there" | `POST /api/ai/goal-summary` | `GEMINI_MODEL_FAST` | Structured JSON: summary |
| Merchant categories | Cash Back | `POST /api/cash-back/categorize` | `GEMINI_MODEL_FAST` | Structured JSON: category per merchant |

The browser sends **inputs only** (a purchase, goal fields, the critical balance and purchases it keeps
in localStorage). The server reloads the active demo profile and recomputes the facts with the same
engine functions the pages use, so the model never sees client-made numbers. The ask box's
`checkPurchase` tool and the Purchase Advisor page both call `checkPurchase()` in
`src/features/calendar/engine/purchaseCheck.ts`, so their verdicts always agree.

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

**Number audit** (`src/lib/ai/audit.ts`): every `$` amount in model text must match a number in the
facts (within $0.50). For the Advisor and goal summary, a failed audit swaps in the template. For the
streamed ask answer, text already shown can't be retracted, so flags go to `done.meta.auditFlags` and
the server log.

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

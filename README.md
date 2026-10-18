# Financial Forecast

SwampHacks XII starter: Next.js App Router, TypeScript, Tailwind, shadcn/ui, and Vitest.

## Start locally

1. Install Node.js 24 LTS and Git.
2. Clone this repository and open the folder in VS Code.
3. Run `npm ci`.
4. Copy `.env.example` to `.env.local` using your editor. Fill in credentials only when available.
5. Run `npm run dev`, then open http://localhost:3000.

Every page reads the selected Nessie customer on the server; without credentials, pages show the Nessie error instead of substituting other data. `/api/dashboard` reports `connected: true` only after it actually read the active customer from Nessie. Nessie is a mock banking sandbox: no real bank connection or transfer is implemented.

## Commands

- `npm run dev`: local server
- `npm run lint`: lint
- `npm run typecheck`: TypeScript checks
- `npm test`: forecast tests
- `npm run build`: production build
- `npm start`: run the built app

## Nessie integration next

Start with the [API quick reference](API-quick-reference.md) and [detailed team API guide](API-guide.md). They cover setup, endpoint schemas and gaps, shared keys, live testing, and connecting the two pages. The current production API base is `https://prod-api.nessieisreal.com`; the documentation website is a different host.

Eight synthetic profiles are seeded into the shared Nessie sandbox with 32 historical transactions, 17 future bill schedules, and one existing loan (see [seeded data, terminal commands, and UI examples](NESSIE-DEMO-DATA.md)). The scenarios include a small cash cushion, a future cash shortfall, and existing debt; debt is displayed separately from available cash. `npm run nessie:read` lists the customers this key can read; `npm run nessie:read -- <customerId>` prints exactly what the app reads for one of them.

## Where the data comes from

- **One authority.** [src/lib/active-customer.ts](src/lib/active-customer.ts) decides whose data is shown: an httpOnly cookie holding a Nessie customer `_id`, checked against `GET /customers` (the first customer when unset or unknown). The layout, every page, `/api/dashboard`, and the AI routes resolve through it; "today" is also decided there, once per request, in America/New_York. Pick the customer on **Profile**.
- **Normalization.** [src/lib/nessie-profile.ts](src/lib/nessie-profile.ts) reads the customer's accounts, then each checking/savings account's deposits, withdrawals, bills, and loans, and converts Nessie dollars to integer cents once. Checking and savings balances are the starting cash; approved loans are shown as debt; credit card accounts provide the Cash Back cards (by nickname). Customer names are the Nessie names.
- **Plan assumptions, labeled.** Nessie has no income schedule or spending budget. Seeded customers use their income, everyday spending, and Cash Back category budget from `data/nessie-demo/plan.json`, matched by the seed's checking-account nickname ([src/lib/plan-assumptions.ts](src/lib/plan-assumptions.ts)). Any other customer gets estimates from Nessie history: the latest deposit repeated monthly, and the last 90 days of withdrawals ÷ 3.
- **Browser state** (goals, purchases you add, card list edits, the critical balance) is saved per customer id received from the server, never sent to Nessie.
- **Fixtures** live only in `src/test-fixtures/` for tests; lint blocks app code from importing them, and only `src/lib/plan-assumptions.ts` may read `data/nessie-demo/plan.json`.

Run `node --env-file=.env.local scripts/nessie-smoke.mts accounts` from the repo root for a read-only connectivity test, after following the quick reference's environment setup. `NESSIE_ACCOUNT_ID` is only used by that smoke script; the app picks the customer itself. Nessie modules are server-only. Never return API keys or raw upstream error URLs. Keep historical posted activity out of future balance calculations.

## Team workflow

New to GitHub? Follow [the step-by-step teammate setup and branches guide](GETTING_STARTED.md).

Read TEAM.md and AGENTS.md first. One person owns dependencies and integration. Create a feature branch, make a small change, run checks, push, and request review. Merge frequently. Commit package-lock.json. Never commit .env.local.

## Publish and deploy

The GitHub repository is [laenhearin/financial-forecast](https://github.com/laenhearin/financial-forecast). The publishing steps below also describe setup for a new clone or fork; check the team's hosting project before creating another deployment.

1. In GitHub Desktop, add this folder as an existing local repository; review files and commit.
2. Publish to GitHub and invite teammates. Teammates clone, then follow Start locally.
3. Import that repository into Vercel with the Next.js preset and Node.js 24.
4. Add the variables from .env.example (Nessie and Gemini) in Vercel project settings → Environment Variables, for Production and Preview; keep values server-only.
5. Deploy and check both the home page and /api/dashboard. Credentials alone do not implement live integration.

## AI layer

The ask box (and Nimbus, the sidebar cloud's chat, which shares its route), Purchase Advisor explanation, Big Purchase summary, and Cash Back merchant categories use Gemini through server-only routes. The forecast engine computes every number; the model only words them, and every surface falls back to labeled template text when AI is off, unconfigured, rate limited, or fails. Without `GEMINI_API_KEY` the app still works on templates. Setup, fallback behavior, `npm run ai:smoke`, `npm run ai:burst`, and free-tier caveats are in [docs/AI_LAYER.md](docs/AI_LAYER.md).

## Reports

Open **Reports** to choose a period and sections, preview a PDF, and download it. Exports use the selected customer and existing forecast engines, with masked identifiers and a summary that falls back automatically if AI is unavailable. No new environment variables are needed; the optional summary uses the existing server-only `GEMINI_API_KEY`.

See [Reports setup, data limitations, and verification](docs/REPORTS.md) for transfer classification, the forecast window, unavailable historical goal/card data, and test commands. PDFs are generated in the browser; report settings and exports are not persisted.

## Current scope

Included: dashboard, calendar, Purchase Advisor, Storm Solver, Forecast Fund (`/big-purchase`), and Swipe and Shine (`/cash-back`), all on live Nessie reads for the selected customer, plus tests.

Known limits: Nessie bills carry no flexibility, so bills are never suggested for cancelling or moving; `GET /accounts/{id}/purchases` responds but returned no records on 2026-10-17, so card-level purchases are not read.

Next: verified Nessie reads, user-confirmed schedules, 30-day calendar, purchase simulator, and optional local storage. No separate database is needed for the initial demo. Forecasts currently report end-of-day balances; they do not model same-day posting order or bank fees.

## Dependency audit note

At setup, npm audit reported a high-severity braces/micromatch/fast-glob advisory in the Next.js ESLint and shadcn dependency chains. The offered automatic fix downgrades major tooling versions and was not applied. Review updated upstream releases before using this starter beyond the mock-data hackathon. Lint, TypeScript, forecast tests, and production build pass with the installed versions.

Development uses Webpack with cross-platform polling because native macOS file watchers were unavailable in the setup workspace. This does not change the production build.

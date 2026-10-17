# Financial Forecast

SwampHacks XII starter: Next.js App Router, TypeScript, Tailwind, shadcn/ui, and Vitest.

## Start locally

1. Install Node.js 24 LTS and Git.
2. Clone this repository and open the folder in VS Code.
3. Run `npm ci`.
4. Copy `.env.example` to `.env.local` using your editor. Fill in credentials only when available.
5. Run `npm run dev`, then open http://localhost:3000.

The home screen and feature pages load the selected synthetic Nessie profile through server-only code. Configure your local Nessie key before opening them. `/api/dashboard` is an older configuration-only route; `/api/demo-data` serves the selected profile. No real bank connection or transfer is implemented.

## Commands

- `npm run dev`: local server
- `npm run lint`: lint
- `npm run typecheck`: TypeScript checks
- `npm test`: forecast tests
- `npm run build`: production build
- `npm start`: run the built app

## Nessie integration next

Start with the [API quick reference](API-quick-reference.md) and [detailed team API guide](API-guide.md). They cover setup, endpoint schemas and gaps, shared keys, live testing, and connecting the two pages. The current production API base is `https://prod-api.nessieisreal.com`; the documentation website is a different host.

Eight synthetic profiles have now been seeded into the shared Nessie sandbox with 32 historical transactions, 17 future bill schedules, and one existing loan. See [seeded data, terminal commands, and UI examples](NESSIE-DEMO-DATA.md). Read a profile with `node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts college`. Choose a user in the Profile dropdown. Home, Calendar, Forecast Fund, Swipe and Shine, Storm Solver, and Purchase Advisor use the selected profile. The added scenarios cover a small cash cushion, a future cash shortfall, and existing debt; debt is displayed separately from available cash.

Run `node --env-file=.env.local scripts/nessie-smoke.mts accounts` from the repo root for a read-only connectivity test, after following the quick reference's environment setup. This script is separate from the app: `/api/dashboard` still does not contact Nessie. Confirm the fields and units needed for each feature before implementing reads in `src/lib/nessie.ts`. That module is server-only. Use `src/app/api/dashboard/route.ts` to expose only the data needed by the UI. Configure `NESSIE_ACCOUNT_ID` to your mock account. Never return API keys or raw upstream error URLs. Keep historical posted activity out of future balance calculations.

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

The ask box, Purchase Advisor explanation, Big Purchase summary, and Cash Back merchant categories use Gemini through server-only routes. The forecast engine computes every number; the model only words them, and every surface falls back to labeled template text when AI is off, unconfigured, rate limited, or fails. Without `GEMINI_API_KEY` the app still works on templates. Setup, fallback behavior, `npm run ai:smoke`, `npm run ai:burst`, and free-tier caveats are in [docs/AI_LAYER.md](docs/AI_LAYER.md).

## Current scope

Included: responsive sample dashboard, seven-day pure forecast, shared types, server-only integration placeholder, six UI components, and tests.

The combined branch also includes `/big-purchase` and `/cash-back`, with their feature engines, tests, and labeled demo data. Their active data source is the selected synthetic Nessie profile, with local forecast assumptions and explicitly estimated monthly rewards budgets.

Next: verified Nessie reads, user-confirmed schedules, 30-day calendar, purchase simulator, and optional local storage. No separate database is needed for the initial demo. Forecasts currently report end-of-day balances; they do not model same-day posting order or bank fees.

## Dependency audit note

At setup, npm audit reported a high-severity braces/micromatch/fast-glob advisory in the Next.js ESLint and shadcn dependency chains. The offered automatic fix downgrades major tooling versions and was not applied. Review updated upstream releases before using this starter beyond the mock-data hackathon. Lint, TypeScript, forecast tests, and production build pass with the installed versions.

Development uses Webpack with cross-platform polling because native macOS file watchers were unavailable in the setup workspace. This does not change the production build.

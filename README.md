# Financial Forecast

SwampHacks XII starter: Next.js App Router, TypeScript, Tailwind, shadcn/ui, and Vitest.

## Start locally

1. Install Node.js 24 LTS and Git.
2. Clone this repository and open the folder in VS Code.
3. Run `npm ci`.
4. Copy `.env.example` to `.env.local` using your editor. Fill in credentials only when available.
5. Run `npm run dev`, then open http://localhost:3000.

The home screen works without credentials and clearly displays fixed demo data. `/api/dashboard` reports configuration status. It does NOT contact Nessie yet. No real bank connection or transfer is implemented.

## Commands

- `npm run dev`: local server
- `npm run lint`: lint
- `npm run typecheck`: TypeScript checks
- `npm test`: forecast tests
- `npm run build`: production build
- `npm start`: run the built app

## Nessie integration next

Confirm the current base URL, authentication method, account endpoint, and response shapes at https://prod.nessieisreal.com/docs before implementing reads in `src/lib/nessie.ts`. That module is server-only. Use `src/app/api/dashboard/route.ts` to expose only the data needed by the UI. Configure `NESSIE_ACCOUNT_ID` to your mock account. Never return API keys or raw upstream error URLs. Keep historical posted activity out of future balance calculations.

## Team workflow

New to GitHub? Follow [the step-by-step teammate setup and branches guide](GETTING_STARTED.md).

Read TEAM.md and AGENTS.md first. One person owns dependencies and integration. Create a feature branch, make a small change, run checks, push, and request review. Merge frequently. Commit package-lock.json. Never commit .env.local.

## Publish and deploy

No GitHub repository or Vercel project has been created automatically.

1. In GitHub Desktop, add this folder as an existing local repository; review files and commit.
2. Publish to GitHub and invite teammates. Teammates clone, then follow Start locally.
3. Import that repository into Vercel with the Next.js preset and Node.js 24.
4. Add the three variables from .env.example in Vercel project settings; keep values server-only.
5. Deploy and check both the home page and /api/dashboard. Credentials alone do not implement live integration.

## Current scope

Included: responsive sample dashboard, seven-day pure forecast, shared types, server-only integration placeholder, six UI components, and tests.

Next: verified Nessie reads, user-confirmed schedules, 30-day calendar, purchase simulator, and optional local storage. No separate database is needed for the initial demo. Forecasts currently report end-of-day balances; they do not model same-day posting order or bank fees.

## Dependency audit note

At setup, npm audit reported a high-severity braces/micromatch/fast-glob advisory in the Next.js ESLint and shadcn dependency chains. The offered automatic fix downgrades major tooling versions and was not applied. Review updated upstream releases before using this starter beyond the mock-data hackathon. Lint, TypeScript, forecast tests, and production build pass with the installed versions.

Development uses Webpack with cross-platform polling because native macOS file watchers were unavailable in the setup workspace. This does not change the production build.

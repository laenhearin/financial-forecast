# Project instructions

Read TEAM.md and README.md before editing. Keep changes small and within assigned ownership. Use npm and retain package-lock.json. Do not add services, databases, or dependencies without a concrete need.

Use TypeScript with strict checks. Keep money in integer cents. Forecast arithmetic must be deterministic and tested. Parse calendar dates consistently; avoid local timezone shifts. Keep hypotheticals separate from recorded transactions.

Nessie API calls and secrets must stay in server-only code. Never prefix secrets with NEXT_PUBLIC_. Never commit .env.local. Confirm actual API schemas rather than guessing. Do not claim configured credentials are a verified connection. Display API errors and label fixture data explicitly.

Use installed framework documentation or current official Next.js documentation when uncertain. Do not disable type checks or lint to hide failures. Run npm run lint, npm run typecheck, npm test, and npm run build for relevant changes. Explain what changed and how to verify it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

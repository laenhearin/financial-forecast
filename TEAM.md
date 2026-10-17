# Team agreement

## Stack
Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, npm, Vitest. Node.js 24. One repository and one application. No database or additional service until the core demo works.

## Ownership
- Integrator: src/app/page.tsx, shared layout, deployment, package.json and package-lock.json.
- Calendar teammate: src/components/pressure-calendar.tsx and day-details.tsx (create these).
- Nessie teammate: src/lib/nessie.ts and src/app/api/dashboard/route.ts.
- Forecast teammate: src/lib/forecast.ts, tests, and purchase-simulator.tsx (create this).
- Coordinate edits to src/lib/types.ts before changing the shared contract.

## Data conventions
Use integer cents, YYYY-MM-DD dates, positive event amounts plus income/expense type. Starting balance is the opening balance on the first forecast date. Exclude transactions already included in that balance. Keep confirmed schedules, estimates, and hypothetical scenarios distinct.

## First milestone
Load one real mock Nessie account through the server and display seven calculated days. Then extend to 30 days and a purchase simulator. Test locally and deployed. Fixtures must remain visibly labeled.

## Working together
Use small branches and pull requests; merge every few hours. Ask your AI tool to read AGENTS.md and this file. Review generated changes and learn how they work. Do not let multiple agents rewrite the same files. Keep a record of AI tools used for the hackathon disclosure.

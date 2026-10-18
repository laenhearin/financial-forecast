# Demo readiness audit — October 18, 2026

Scope: the existing application, financial correctness, server-only credentials, AI reliability, live read-only Nessie integration, local production-browser journeys, and judging preparation. No redesign, new service, authentication system, dependency change, seed write, history rewrite, force push, or merge into main was performed.

The supplied request ends partway through its demo checklist with “(7 KB left).” This review implements the visible requirements; it does not assume requirements from the missing tail.

## Starting state

- Baseline: `a22be0f46a193a2f8b5b2c88dab9e9f9ca8471b4`, on `main`, clean worktree, tracking `origin/main`.
- Work isolated on `codex/demo-readiness-audit`.
- Read `AGENTS.md`, `TEAM.md`, README, integration/report/AI documentation, current implementation and tests. Read installed Next.js route-handler and error-handling guides before changes.
- Stack verified in `package.json`: Next 16.4.2, React 19.3.1, TypeScript 6, Tailwind 4, Base UI/shadcn, Gemini SDK, React PDF, Recharts, Motion, Vitest and Testing Library. npm and lockfile retained.
- Baseline checks actually completed successfully: lint with zero problems, typecheck, **417 passed / 1 skipped**, production build. The old six Forecast Fund assertion failures were already fixed before this baseline; they were not reproduced in this revision.
- Both Nessie and Gemini credential variables were configured locally. Configuration alone was not treated as proof of connection.

## Confirmed defects fixed

| Priority | Confirmed behavior | Contained fix and regression evidence |
| --- | --- | --- |
| P1 | Chat emitted model text before its number audit. An invented `$7,777` was visible and only flagged afterward. Partial text also survived provider failures. | `ai/server/ask.ts` withholds answer text, audits it, then emits one validated answer or a deterministic template. Tool progress still streams. Failed partial answers are discarded before retry. Updated handler tests reject visible invented/partial text. |
| P1 | Chat cache used only a 14-day summary. Different customers or a purchase after that window could reuse an answer despite different full forecasts/account liquidity. | Cache now hashes complete server financial context plus history/source/question. Regression with matching short summaries fails on the baseline cache and passes after the fix. No credentials are included in that context. |
| P1 | A lone gift, refund, reimbursement, unidentified deposit or bonus became monthly paycheck income; zero-value deposits could form invalid schedules. | `estimateIncome()` excludes explicit one-time inflows and zero amounts. A single deposit must have a pay-like label to produce a labeled monthly estimate. Existing recurring-series and seeded-plan behavior retained. Six new normalization cases reproduced the defect before the fix. |
| P1 | A savings plan with zero earmark could report an OK tier while baseline cash was negative. A negative day before the first payday could still allow “never negative” contribution candidates. | `plan.ts` explicitly rejects negative base days in feasibility scans and records every negative spendable day, including zero contributions. Tests reproduce both cases. |
| P1 | A goal already covered by current cash was rejected solely because there were no future paychecks. | `computeForecast()` checks full-horizon affordability before requiring future paydays. Separate tests cover funded-without-payroll and unfunded-without-payroll cases. The old no-paycheck test now uses insufficient cash so it tests the intended failure instead of contradicting the supported affordable-now case. |
| P1 | A plan could mechanically fill an earmark while going overdrawn, yet its hero, goal summary/tool and report completion date described it as affordable. | Hero displays the shortfall. Goal summary uses a deterministic warning without a model call; goal-tool output has no affordable date and includes the shortfall. Reports omit completion estimates for alert plans. Raw simulation still exposes earmark progress for scenario exploration. New UI/route/tool regressions cover the contradiction. |
| P1 | Advisor said the paying account “can cover the payment on its own” when both that account and total cash were negative, because its transfer-needed flag was false. | Separate negative-account wording from the transfer warning and positive liquidity message. A component test exercises the actual two-account UI. |
| P1 | AI money tools rounded sub-cent positive inputs such as `0.001` into a free purchase or silently changed excessive precision. | Reuse the existing strict decimal parser; reject nonfinite, nonpositive, excessive-precision and out-of-range values. Valid `$1.99` remains exact. Two new validation cases failed before the fix. |
| P1 demo tooling | Documented `ai:smoke` and `ai:burst` called removed `/api/demo-data`, immediately returning 404. | Use the real `/api/dashboard` read path. Dashboard now returns existing cash account IDs alongside its snapshots, allowing the read-only Advisor probe. Smoke goals are explicitly local hypothetical inputs, never banking data. Route regression verifies IDs, success/failure connection state and absence of the test key. |

The first focused run reproduced **11 failing cases** for income, streaming and savings. The separate precision run reproduced **2 failing cases**; cache isolation and the old smoke endpoint were also observed failing before correction. Existing assertions were retained except where behavior deliberately changed from displaying rejected text or refusing an already-funded goal. No lint/typecheck settings were relaxed.

## Verified existing behavior retained

| Area | Result and practical limit |
| --- | --- |
| Recurring bill start dates | Already fixed in baseline: a valid future Nessie `payment_date` becomes `startDate`; monthly schedules do not fire early. Added today/past/one-month/two-month normalization checks. Missing/malformed optional payment dates still leave schedules unbounded; this is a known data-quality limit. |
| Calendar dates | UTC date-only arithmetic; monthly day 31 clamps to the shorter month's last day, leap years included. Today's snapshot is treated as end of day, so scheduled events start tomorrow. A pending bill due today is assumed included, not charged twice. |
| Internal transfers | Tagged or clearly described checking/savings transfers are excluded from income/spending inference, retained in recorded account activity. Ambiguous descriptions are not guaranteed classified correctly. |
| Spending | Everyday categories only are averaged; tagged one-offs, bills, transfers and savings are excluded. Empty/sparse history remains labeled. Refunds do not become payroll; no complete refund-to-purchase reconciliation was added. |
| Currency | Dollars become safe integer cents once at normalization; typed dollars are parsed strictly; forecasts sum cents. Added repeated $1.99, 1.5%, zero and negative conversion checks. Rewards/cap tests remain unchanged and pass. |
| Purchases | Same-day effect, subsequent balances, rent impact, before/after payday, earliest safer date, saved recurring purchases, aggregate versus paying-account cash, form limits, and API/tool date validation have coverage. The internal pure engine expects validated inputs; public input boundaries validate them. |
| Forecast Fund | Uses 60 months, actual paycheck dates, bounded $5 scans, buffer and never-negative limits, partial final contribution, deadline search, no-paycheck state, and deterministic property tests. A custom unsafe contribution remains an explicitly warned scenario. |
| Profiles | Cookie selection validated against Nessie's customer list; per-customer browser stores; pages keyed by scenario/customer. Fresh browser starts with the first readable customer. This is demo selection, not authentication. |
| Nessie | Server-only, fixed HTTPS host, no redirects, request timeout and sanitized failures. Normal viewing/forecasting/AI routes never invoke the seed write helpers. Live reads succeeded for all eight profiles. |
| AI | Four read-only tools: `checkPurchase`, `getForecast`, `getGoalTimeline`, `getDayDetail`. Request/body/range validation, model limits, retry/fallback policy and per-process rate limiting retained. New cache and pre-display audit safeguards are tested offline. |
| Reports | Browser rendering, masked output, explicit unavailable-data sections, deterministic aggregates, template summary fallback and bounded transactions. Alert savings plans no longer get a completion date. |

## Security findings and limits

No configured Nessie/Gemini credential matched tracked files, reachable Git objects checked (1,841 objects), or generated `.next/static` client bundles. `.env.local` remains ignored; only `.env.example` is tracked. This checks the two known configured values, not every possible historical/encoded secret or external log. No secret values were printed or committed.

Source review found no browser imports of the secret-bearing wrappers, arbitrary upstream host, dynamic HTML injection, or AI financial mutation tool. Tests cover sanitized upstream HTTP failures, network failures, IDs/dates, cross-origin AI requests, oversized/invalid bodies and rate limiting. We did not conduct penetration testing or audit external hosting logs.

`npm audit --omit=dev` reports **7 high / 0 critical** entries in the installed shadcn/fast-glob/micromatch/braces dependency chain. The underlying [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version as checked on October 18, 2026. `npm ls` confirms `braces@3.0.3`; npm's suggested remedy includes a major tooling downgrade. We did not use `audit fix --force` or change dependencies. No user-input-to-glob execution path was found in the application routes; this narrows observed demo exposure but does not resolve the advisory.

### Remaining risks, ordered by next value

1. **P1 — AI semantic correctness:** A known dollar value can be attached to the wrong fact; dates, percentages, signs, unsupported scenarios and risk wording are not proven correct by the audit. Prompt instructions require engine verdicts but are not an enforcement proof. Use deterministic Advisor/Fund output as authoritative. A stronger structured claim/verdict validator is a follow-up, not an untested last-minute chat rewrite.
2. **P1 — Assumption quality:** Two similar deposits may coincide; a single pay-labeled deposit does not establish cadence. Sparse withdrawals can understate spending despite the coverage warning. Add user-confirmed schedules and budgets, then backtest. “Established” coverage is a record-count/span heuristic, not certified completeness.
3. **P1 for production — No authentication/authorization:** Any visitor can switch among customers this server's key can read. Verified profiles are synthetic seeded scenarios. Do not add real customer records to this demo key/deployment. Selection validation does not create privacy boundaries between visitors.
4. **P1 for public quota protection — AI rate limits/cache are process-local:** Multiple Vercel instances do not share a global limit; anonymous callers can consume quota. Tools are read-only and bodies are constrained, but real production needs distributed quota/identity controls.
5. **P1 dependency maintenance — Unpatched tooling advisory:** Keep monitoring upstream fixes; do not replace major dependencies immediately before judging without a verified migration.
6. **P2 — Liquidity/timing:** Scheduled items post to the first cash/checking account; account transfers and intraday order are not simulated. Paying-account warnings improve clarity but do not guarantee future availability.
7. **P2 — History and reward reconciliation:** Historical balance reconstruction assumes available transactions explain the snapshot. Nessie seed writes were previously observed not changing account balance; that mutating behavior was not re-tested in this read-only audit. Actual per-card purchases, credited rewards and linked bill payments are unavailable.
8. **P2 — Forecast boundaries:** Advisor's safer date is constrained to 90 days. A later candidate has a shorter remaining observation interval, not a new 90-day window after that date. Fund uses 60 months and static scenario assumptions; no unforeseen job-loss model exists.
9. **P2 — Stress coverage:** No measured forecast backtest, production load test, complete adversarial prompt suite, throttled-network run, or hosted Vercel verification was performed. Manual follow-ups are in the runbook.

## Verification record

| Check | Baseline | Final |
| --- | --- | --- |
| `npm run lint` | Pass, zero problems | Pass, zero problems |
| `npm run typecheck` | Pass | Pass |
| `npm test` | 417 passed, 1 optional PDF test skipped | **443 passed, 1 optional PDF test skipped** |
| `npm run build` | Pass | Pass; local production routes exercised |
| Optional `REPORT_PDF_SMOKE=1 …pdf.test.tsx` | Not part of baseline | Pass: actual React PDF render, 1,005 fixture inputs, 1,000 printed |
| `scripts/verify-demo.mts` | Not present | Successful live read/engine rehearsal for 8 synthetic profiles |
| Browser rehearsal | Not claimed for baseline | Desktop production build, 8 routes, student/commuter switching and refresh, purchase timing/duplicate guard, Fund creation and contribution, monthly graph, failed-summary PDF download, mobile overflow, 400/404 handling; no page errors |

One optional PDF test is normally skipped in `npm test`; it was also explicitly run with its opt-in flag. Typecheck was rerun successfully after the final build: a simultaneous attempt had encountered a transient missing generated `.next/types/routes.js` while Next regenerated it. Run those two commands sequentially when reproducing.

Additional completed probes:

- **Forced AI fallback:** `ai:smoke --expect template` passed Advisor, goal summary and Ask on a separate production process with `AI_FORCE_FALLBACK=true`. No local environment file was changed.
- **Configured live Gemini:** `ai:smoke --expect any` passed all three surfaces with `source=model` responses (Flash Lite for the structured surfaces, Flash for Ask, including a `checkPurchase` tool event). This verifies those requests, not perpetual service availability.
- **Student Nimbus rehearsal:** the $500 laptop answer matched Advisor's CRITICAL verdict, $42.32 combined low, −$357.68 checking low and December 18 safer date. The $50,000-car prompt received an explicit refusal to call it affordable, with the tool's below-zero result. The stopped-income question acknowledged that missing-income scenarios are not directly modeled. These are three observed responses, not an adversarial safety guarantee.
- **Burst command:** two requests against the forced-fallback process returned HTTP 200/template; this verifies the repaired command, not a load/rate-limit benchmark.
- **Unavailable Nessie configuration:** a separate production process with an invalid base returned dashboard HTTP 503/`connected:false`, while the home page displayed a visible diagnostic rather than a fabricated account. Actual network-outage handling is covered with a rejected-fetch regression; no live outage was induced.
- **PDF inspection:** downloaded the September report (11 pages) and This year report (17 pages) with summary requests failing. The year report included 10 contents links, forecast content, expected $750/$542.32 values, no NaN/Infinity and correct numbered footers on every interior page. Rendered summary/chart/final-section pages were visually inspected for clipping and layout.

Browser checks used an isolated temporary Chrome profile with fresh storage. Actual financial input was live Nessie sandbox data. Advisor/goal/report summary requests were deliberately returned as 503 by the browser harness to exercise local fallbacks. This does not prove Gemini connectivity. AI provider behavior is separately probed through the server routes; no sandbox records are written.

## Reproduce and review

Use the commands in the [demo runbook](SWAMPHACKS_DEMO_RUNBOOK.md). Relevant focused tests:

```sh
npx vitest run src/lib/nessie-profile.test.ts src/lib/nessie-api.test.ts src/lib/money.test.ts src/lib/ai/server/handlers.test.ts src/lib/ai/server/tools.test.ts src/features/big-purchase/engine/plan.test.ts src/features/big-purchase/components/Hero.test.tsx src/features/calendar/components/PurchaseAdvisorApp.test.tsx src/app/api/dashboard/route.test.ts
```

Ordinary tests use mocked providers and require no credentials/network. The live read verifier and running-app smoke commands are deliberately separate. The branch is for review; main and the remote were not updated by this audit. OpenAI Codex assisted with source review, implementation, tests and documentation; include this in the team's hackathon AI-tool disclosure as appropriate.

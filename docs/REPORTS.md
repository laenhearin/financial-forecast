# Exportable financial reports

Open **Reports** from the sidebar (`/reports`). Last month and six essential sections are selected initially. Choose a preset or custom dates (typed fields or the calendar popovers), select sections, then Generate report. Download saves `report-START_to_END.pdf`. Changing settings keeps the previous preview and marks it stale until regenerated. Reports and their settings are not persisted.

## Data and calculations

- The server loads the same active Nessie customer as the other pages. A failed read shows an error; there is no fixture substitution. Existing browser goals, card preferences, purchases and critical balance are read per customer, never written by Reports.
- All calculations keep integer cents. The summary endpoint also accepts cents and converts to dollars only for the existing AI provider. Dates use the app's authoritative America/New_York day and UTC date-only arithmetic, rather than a different browser time zone.
- Income and spending use completed deposits and withdrawals on or before today. Explicit own-account transfer descriptions are paired by date, amount, opposite direction and owned account type; matching amounts alone are insufficient. The savings leg counts once as savings contributed. Explicit savings/529/brokerage contribution descriptions are also excluded from spending and labeled as savings/investment estimates. Other merchant categories reuse Cash Back's keyword classifier. These are description-based classifications, not bank-confirmed transfer/category metadata.
- Historical balances reuse `historicalBalances` to reconstruct estimates from the current snapshot and recorded activity. They are not historical bank statements. Missing activity can change them. Previous-period totals reflect available records, including zero when none are available.
- Future balances reuse `buildCalendarModel` and stop at its 90-day horizon. The forecast calendar shows today through `min(max(range.end, today + 6), today + 30)`, only if the selected range ends today or later. It uses the existing six `balanceLevel` bands and the calendar's colors. Hypothetical purchases are evaluated separately, not counted as recorded spending or added to the baseline chart.
- Overview, category and flow totals include all recorded rows in the period. Only the detailed transaction table is capped at 1,000, with a notice. Balance chart sampling retains endpoints, extrema and the actual/forecast join.
- Numbers and identifier-like text are masked before entering `ReportData`. The current feed supplies account IDs, not account/card numbers: `****` means the number is unavailable; IDs are never repurposed as account numbers.

## Sections and current data gaps

The [demo readiness audit](SWAMPHACKS_AUDIT.md) records current verification. Savings goals whose plans go below zero do not receive an estimated completion date in exports; a mechanical earmark date is not presented as feasible affordability.

All upstream modules exist, so all sections remain selectable. An empty module renders an explanatory empty state. The forecast toggle is unavailable for fully past ranges.

| Section | What it can show now |
| --- | --- |
| Overview and charts | Recorded totals, previous-period comparisons, category/flow charts, reconstructed and projected balances. |
| Savings goal progress | Current saved goals and completion estimates from `computeForecast`. Actual contributions and historical goal snapshots are not stored, so saved amounts/percentages are explicitly unavailable. Past ranges show that limitation. Up to eight goals are drawn. |
| Bills and paychecks | Recorded deposits (not all necessarily paychecks) and future scheduled bills/estimated income. Historical bill-payment links are absent, so no payment is guessed to be a paid bill. |
| Forecast calendar | 7–31 days, matching current balance bands; source and window stated. |
| Transactions | Completed deposits/withdrawals, descriptions, estimated categories, masked accounts, signed amounts, stable date ordering. |
| Cards and rewards | The current selected card lineup. Card-level purchases are not loaded by the existing Nessie adapter. Spend/rewards remain unavailable; cash withdrawals are never attributed to a card. Once that upstream data exists, use the existing rewards engine with its caps, not a flat rate approximation. |
| Purchase Advisor | Saved future hypothetical purchases in the selected range, recalculated with `checkPurchase`. Unsaved checks and past verdicts are not stored. Recurring items use their next applicable occurrence. |
| Storm Solver | Current guidance from `stormAdvice`. No saved bill-date changes or before/after risk results exist, and Nessie bills have no flexibility metadata. Those figures are not invented. |

## Implementation and environment

The implementation follows the requested milestones: foundation/options, deterministic data builder, PDF cover/contents/overview, charts, schedules/weather, summary route/state handling, detailed sections, then tests and polish. The existing calendar changes are a separate preceding commit.

Pure report calculations live in `src/lib/reports`; the profile adapter reuses existing engines. UI lives in `src/components/reports`, and PDF components in its `pdf` folder. `@react-pdf/renderer` is imported on Generate in the browser, then renders to a Blob. Object URLs are revoked when replaced or the page unmounts. The contents links target PDF section anchors; contents page numbers are deliberately omitted, and interior footers show actual document page numbers. Large transaction tables wrap without splitting rows; column headers on continuation pages are best effort.

No new environment variables or services. Reports uses the existing server-only `GEMINI_API_KEY` and AI runtime settings documented in [AI_LAYER.md](AI_LAYER.md). `AI_FORCE_FALLBACK=true`, a missing key, provider errors, and the client eight-second timeout all produce a labeled deterministic summary. The client sends only allow-listed aggregates to `POST /api/reports/summary` (4 KiB limit), never transaction lists or account identifiers. AI wording goes through the existing number audit. No PDF is generated on the server in the application.

New runtime dependencies: `@react-pdf/renderer` for PDF export and the shadcn Calendar's `react-day-picker`/`date-fns` dependencies. New test dependencies: React Testing Library and jsdom for interaction tests. Popover and Checkbox use the existing Base UI package.

Reference implementations: [react-pdf wrapping/fixed elements](https://react-pdf.org/docs/v4/advanced/page-wrapping), [dynamic page numbering](https://react-pdf.org/docs/v4/advanced/dynamic-content), and [shadcn date picker composition](https://ui.shadcn.com/docs/components/base/date-picker).

## Verify

```sh
npm ci
npm run dev
# Visit /reports; generate Last month, This year + Select all, and a Custom range.
npx vitest run src/lib/reports src/components/reports
npm run lint
npm run typecheck
npm test
npm run build
```

Optional real-render performance smoke test (fixture data only; writes `reports-performance.pdf` and timing JSON into the OS temporary directory):

```sh
REPORT_PDF_SMOKE=1 npx vitest run src/lib/reports/__tests__/pdf.test.tsx
```

Interaction tests mock the PDF renderer and summary network response. They cover defaults, selection, invalid dates, past forecast availability, stale previews, fallback, Retry and late results after unmount. Pure tests cover date boundaries, transfer classification, sums, chart geometry, truncation, masking, existing-engine integration and summary validation/timeout.

When Reports was written, six Forecast Fund assertions failed on main (goal cost limit, horizon length, advice/contribution/deadline expectations). Commit 0eed820 fixed them in the engine and tests, and the unused `RecordedPayment` lint warning in `src/app/calendar/page.tsx` has been removed; on 2026-10-18 lint, typecheck, the full test suite, and the production build all pass.

Local verification on 2026-10-18: the real-render fixture produced 43 pages in approximately 2.8 seconds for 1,005 inputs (1,000 printed). Browser checks covered desktop/mobile layouts, stale previews, fallback export, clickable contents and footer numbering on every interior page. This is an observed local measurement, not a performance guarantee.

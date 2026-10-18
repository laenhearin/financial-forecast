# Judge prep

Answers to likely judging questions, checked against the code on 2026-10-18. Every number here comes from the repo or from a run that day. If you change the code, re-check the matching answer.

## The one-line pitch

Financial Forecast turns a customer's Capital One Nessie data into a day-by-day cash forecast, then uses it to check purchases, find tight spots, plan savings, and pick credit cards. A deterministic TypeScript engine computes every number; Gemini only explains them.

## What changed after the code review

| Review issue | Status | Where |
|---|---|---|
| 1. Recurring bills charged before their first payment | Fixed: a recurring bill starts no earlier than its Nessie `payment_date` | `src/lib/nessie-profile.ts` (`toBill`), `schedule.ts` (`startDate`) |
| 2. Income guessed from the latest deposit | Fixed: detects weekly, biweekly, or monthly series with similar amounts; otherwise the most paycheck-like deposit, labeled "estimate from one deposit" | `estimateIncome` |
| 3. Total cash hides a short checking account | Fixed: Purchase Advisor and Nimbus also check the paying account and say when money has to move first | `purchaseCheck.ts` (`payingAccount`, `needsTransfer`) |
| 4. No same-day posting order | Disclosed on every forecast page and in Nimbus's rules | `src/lib/data-source.ts` |
| 5. Saturday spending spikes | Relabeled "Estimated weekly spending" and explained on every forecast page | `entries.ts`, `data-source.ts` |
| 6. Thin history understates spending | Added a coverage note: established, limited, or too thin (months and record count) | `spendingCoverage` |
| 7. Rewards look like real earnings; issuer preference in ties | Labeled as simulated estimates; ties now go to popularity, then card id, never issuer | `SummaryStrip.tsx`, `rankCards` |
| 8. AI audit only sees "$" amounts and flags are invisible | Also catches "dollars", "USD", "$15k"; flagged answers show a note in the ask card and Nimbus; limits documented | `src/lib/ai/audit.ts`, `docs/AI_LAYER.md` |
| 9. No sign-in | Documented as a prototype limit (synthetic data only) | README, "Known limits" |
| 10. Nessie writes don't move the balance | Documented; demo purchases through Purchase Advisor, not live Nessie writes | README, "Known limits" |
| 11. Reports doc said six tests fail | Stale: fixed in commit 0eed820. All checks pass today | `docs/REPORTS.md` |
| Review test 6: untagged transfers counted as income | Fixed: "Transfer to/from checking/savings" is a transfer; "interest" deposits are interest | `src/lib/spending-categories.ts` |

**Checks on 2026-10-18:** `npm run lint` (0 problems), `npm run typecheck`, `npm test` (all pass), `npm run build`. All seven pages load for all eight Nessie customers.

## Review test cases: where each one stands

"Automated" means a Vitest test asserts it. "Live" means it was run against the production build with real Nessie and Gemini on 2026-10-18.

| # | Case | Result | How it's covered |
|---|---|---|---|
| 1 | Empty account | No fake income; spending empty | Automated (`nessie-profile.test.ts`) |
| 2 | No paycheck | Forecast Fund shows its no-paycheck state | Automated (`plan.test.ts`) |
| 3 | Gift mistaken for income | A regular paycheck series wins; a gift alone is labeled one-deposit | Automated |
| 4 | Recurring bill starting in two months | Not charged before its start | Automated |
| 5 | Bill on the 31st | Clamps to the month's last day, leap years included | Automated (`schedule.test.ts`) |
| 6 | Internal transfer | Not income, not spending | Automated (labels and seed tags) |
| 7 | Nessie outage | Error card, never substitute data | Automated |
| 8 | Unknown account type | Clear error card naming the record (deliberate: no guessing at schemas) | Automated |
| 9 | No credit cards | "Add the cards in your wallet…" empty state | Code review |
| 10 | Switching customers | One cookie authority; pages keyed by customer | Automated + live (8 customers) |
| 11 | $0 purchase | Rejected by the form | Code review |
| 12 | Purchase larger than all cash | BELOW $0 verdict | Automated |
| 13 | $100 checking, $5,000 savings, $1,000 purchase | Overall fine, "move money into Checking first" | Automated + live |
| 14–15 | Before vs. after payday | After payday rates better | Automated |
| 16 | Bill and purchase on one day | Both in that day's end-of-day balance | Automated |
| 17 | Date past 90 days | Form limits the date to the window | Code review |
| 18 | Existing recurring purchase | Included in the baseline | Automated |
| 19 | Duplicate add | Button disables after one add | Code review |
| 20 | Safer date | Earliest date at caution or better | Automated |
| 21 | $1 goal | Funded on the first paycheck, no overshoot | Automated |
| 22–23 | Already affordable / impossible goal | Affordable now / null date | Automated |
| 24 | $0 contribution | Never reaches the goal; no loop | Automated |
| 25 | Buffer bigger than cash | Suggests $0 | Automated |
| 26 | Biweekly paychecks | Counts real paydays | Automated |
| 27 | Deadline before completion | Smallest working amount, or none | Automated |
| 28 | No income | No-paycheck state | Automated |
| 29 | Plan leaves cash below $0 | Alert tier naming the first negative date | Automated (contribution case; not a separate bills-exceed-income case) |
| 30 | Contribution above a paycheck | Alert tier; limit stays at or below the paycheck | Automated |
| 31 | Invented dollar figure | Template replaces structured answers; ask/Nimbus show a note | Automated |
| 32 | Right number, wrong context | **Not caught** (known limit; say so) | Automated (documents the gap) |
| 33, 39 | AI forced off / no key | Templates; engine numbers unchanged | Automated |
| 34 | Rate limit | 429 with a friendly message | Automated |
| 35 | Off-topic question | Redirects to forecast questions | Live |
| 36 | "Next Friday" | Picked Fri, Oct 23 and said the date | Live |
| 37 | Rapid questions | New request aborts the old one | Code review |
| 38 | Switch customer, ask again | AI routes resolve the same active customer | Code review |
| 40 | User asserts a wrong balance | Corrected from the forecast | Live |

### Three Nimbus questions, checked against the engine (College student, 2026-10-18)

- **"I want to buy a $500 laptop tomorrow…"** Nimbus: critical, wait or lower the cost. Purchase Advisor, same inputs: lowest $42.32 on Nov 1, and Checking alone −$357.68, so move money first. They agree.
- **"What's the lowest my balance will get over the next 30 days?"** $542.32 from Nov 1, caused by the $650 Housing bill. That's the Advisor's $42.32 plus the $500 laptop.
- **"How long to save $1,200 at $50 per paycheck?"** 24 paychecks, Fri, Sep 10, 2027 (the 24th biweekly payday after Oct 23, 2026).

These make a good live demo: ask Nimbus, then show the same numbers on Purchase Advisor and Forecast Fund.

## Likely questions and answers

**1. How do you generate future balances?**
We start from the customer's checking and savings balances in Nessie. We add scheduled income, Nessie bills, and estimated everyday spending as dated events, then walk forward one day at a time: today's end-of-day balance = yesterday's + income − expenses. The calendar covers 90 days; Forecast Fund runs 60 months.

**2. Why deterministic code instead of machine learning?**
The same inputs always give the same balances, so we can test them (over 400 tests) and explain every number. Gemini only puts the engine's results into words. Deterministic doesn't mean accurate: it's only as good as its assumptions, which is why we show them on every page.

**3. How do you handle irregular purchases?**
Each transaction is classified as everyday spending, one-off, bill payment, saving, transfer, income, or interest. Only everyday spending is averaged into the forecast; one-offs aren't projected forward, and bills come from Nessie's schedule. Seed data carries explicit tags; other records are classified by label keywords, which is an approximation.

**4. How accurate are your predictions?**
We haven't measured accuracy yet, so we don't claim a figure. They're scenario estimates from known balances, scheduled bills, and spending assumptions, and the page labels them. The next step is a backtest: forecast from older history and compare with what happened later.

**5. What if someone loses their job?**
The baseline assumes paychecks continue, and we say so. A "lost income" scenario is on our list.

**6. What if there's very little history?**
Spending averages up to six months of history, and every forecast page now states the coverage: for example "established (5.9 months, 90 spending records)", or "too thin for a reliable estimate", with a warning that missing records make spending look lower than it is. Income for customers without a plan comes from deposits that repeat on a schedule; a single deposit is labeled as such.

**7. How does Nessie connect to the app?**
Server-only. For the selected customer we read accounts, then each checking and savings account's deposits, withdrawals, bills, and loans. `nessie-profile.ts` normalizes them into one scenario that every feature shares. The API key never reaches the browser.

**8. Why normalize the data?**
So every engine reads one consistent shape instead of raw API responses. Money becomes integer cents once, at that boundary, to avoid floating-point errors.

**9. What if Nessie is down?**
The page shows an error card. We never substitute fake data. (AI text has its own template fallback, which is separate.)

**10. How do you avoid duplicate transactions?**
Seed records carry stable markers, so re-seeding doesn't duplicate them. General deduplication of arbitrary bank data would need a reconciliation policy on transaction ids; we haven't built that.

**11. Why two forecast horizons?**
The calendar answers near-term questions (90 days). Forecast Fund answers "when can I afford it", which can take years, so it runs 60 months on the same events. Long-range numbers are more sensitive to the assumptions.

**12. How many API calls does loading a customer take?**
For a customer with two cash accounts: 1 (customer list) + 1 (accounts) + 4 per cash account (deposits, withdrawals, bills, loans) = 10, with the per-account reads in parallel. React's request cache stops repeats within one page render.

**13. What exactly does Gemini do?**
It writes the Purchase Advisor explanation, the Forecast Fund summary, the Reports summary, merchant categories for Swipe and Shine, and Nimbus's answers. It never produces a number the app relies on.

**14. Can Gemini act inside the app?**
Read-only. Nimbus can call four tools backed by the engine: `checkPurchase`, `getForecast`, `getGoalTimeline`, and `getDayDetail`. It cannot move money or change settings.

**15. How do you stop hallucinated numbers?**
Three layers: the engine computes everything; structured answers are schema-validated; and a number audit checks every money amount in AI text against the facts we sent, falling back to a template for structured answers and showing a "didn't match your forecast" note for streamed ones. Be honest about the limit: the audit doesn't check percentages or dates, and it can't tell when a real figure is attached to the wrong thing. It reduces risk; it doesn't guarantee correctness.

**16. What if Gemini runs out of credits during judging?**
Every AI surface falls back to template text built from the same engine facts, labeled "From template". The forecasts, verdicts, and plans don't change. To prove it, set `AI_FORCE_FALLBACK=true` and restart.

**Also be ready for:**

- **"Can I see someone else's data?"** In this prototype, yes: you can switch between the synthetic Nessie customers on purpose so judges can try scenarios. A real product needs sign-in and per-user authorization.
- **"Why did the balance not drop when you posted a withdrawal to Nessie?"** Nessie's sandbox didn't update `balance` when we posted completed transactions. That's why we demo purchases with the Purchase Advisor instead.
- **"Are these real rewards?"** No. Swipe and Shine simulates rewards from category spending and each card's rules. Nessie returned no card-level purchases.

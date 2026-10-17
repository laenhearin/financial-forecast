# Seeded Nessie data: terminal commands and UI examples

Verified against the API on **2026-10-17**. These are **synthetic records stored in the live Nessie sandbox**, not real bank/customer activity. Ages and finances are assigned demo personas, not facts inferred about the existing names.

## What is now in the API

At the original seed, there were only three customers available. We preserved those customers and the original account, then created two clearly fictional customers. The original assignment follows the first response's customer order; future runs recover it from seed markers. This extension adds three new customers without assigning their personas to existing customers.

| Profile slug | Existing or new customer | Checking snapshot | Savings snapshot | Hypothetical goal | Preferred deadline |
| --- | --- | ---: | ---: | --- | --- |
| `college` | Existing `string string` | $350 | $400 | $1,200 laptop; $300 buffer | 2026-12-16 |
| `twenties-a` | Existing `Demo Forecast` | $1,100 | $1,200 | $1,800 weekend trip; $1,000 buffer | 2026-12-31 |
| `twenties-b` | Existing `Alejandro Ponce` | $850 | $800 | $4,000 car down payment; $1,000 buffer | 2027-02-14 |
| `midlife` | New `Demo-midlife ff-demo-v1` | $4,200 | $9,500 | $2,400 appliance; $3,000 buffer | 2027-01-15 |
| `older` | New `Demo-older ff-demo-v1` | $1,800 | $16,000 | $3,000 family visit; $2,500 buffer | 2027-02-14 |
| `teen-low-cash` | New `Demo-teen-low-cash ff-demo-v1` | $85 | $15 | $120 school headphones; $100 buffer | 2026-12-18 |
| `college-shortfall` | New `Demo-college-shortfall ff-demo-v1` | $220 | $30 | $450 refurbished laptop; $100 buffer | 2027-01-15 |
| `existing-debt` | New `Demo-existing-debt ff-demo-v1` | $60 | $0 | $90 work shoes; $100 buffer | 2027-01-15 |

Created and read back:

- **32 historical transactions total:** eight deposits and 24 withdrawals, four per person. All dates fall within the inclusive 90-day window **2026-07-20 through 2026-10-17**. This is a small selection of activity, not a complete 90-day statement or a basis for estimating a person's income from frequency.
- **29 supporting accounts:** checking and savings for each person, two card shells per original profile, and one per new profile. The pre-existing account remains, giving 30 accounts total for this seed and the original account.
- **17 recurring bills:** housing, utilities, transport, and a loan payment as appropriate. These are future bill schedules, separate from the 32 posted transactions. Nessie bill records are not PDF bank statements.
- **One existing personal loan:** $1,500 outstanding in the seed convention, with a $75 monthly payment. Only its scheduled payment reduces cash; the principal is shown as a separate liability.
- Eight local hypothetical goals and explicit future-income/spending assumptions in [the seed plan](data/nessie-demo/plan.json). These fields are not native Nessie fields and were not sent as transactions.

Examples include campus wages/textbooks/groceries, an early-career paycheck/dining/cinema, a commuter's gas and tires, a household's groceries and repairs, and a semi-retired person's income, pharmacy purchase, and family meal. These are individual fictional examples, not claims about what everyone of an age buys.

Every new account nickname and transaction description contains `ff-demo-v1`. Existing names, addresses, accounts, and balances were not overwritten. All five added customer names explicitly say Demo.

## Read names and transactions directly from Terminal

Run these commands **from the repository root**. No Next.js server or application script is required. The shell reads your trusted local environment file; the key itself never needs to appear in a command you paste.

```zsh
set -a
source .env.local
set +a

# This small shell shortcut runs curl. It sends the key via stdin, not process arguments.
nessie_get() {
  printf 'url = "https://prod-api.nessieisreal.com%s?key=%s"\n' "$1" "$NESSIE_API_KEY" |
    curl --config - --silent --show-error --fail
}

# All customers, including names and IDs:
nessie_get /customers

# Only names and IDs, if jq is installed:
nessie_get /customers | jq '.[] | {id: ._id, name: (.first_name + " " + .last_name)}'

# Account names and balances:
nessie_get /accounts | jq '.[] | {id: ._id, customer: .customer_id, nickname, type, balance}'

# Select the seeded college checking account without copying a hardcoded ID:
COLLEGE_ACCOUNT_ID="$(nessie_get /accounts | jq -r '.[] | select(.nickname == "ff-demo-v1/college/checking") | ._id')"

nessie_get "/accounts/$COLLEGE_ACCOUNT_ID/deposits" | jq
nessie_get "/accounts/$COLLEGE_ACCOUNT_ID/withdrawals" | jq
nessie_get "/accounts/$COLLEGE_ACCOUNT_ID/bills" | jq
```

`jq` only formats/filters JSON. If unavailable, omit the `| jq` parts and copy an account `_id` from the raw response into `COLLEGE_ACCOUNT_ID`. `GET` reads, `POST` creates, `PUT` updates, and `DELETE` removes a resource. Only use methods documented for the particular path; not every resource supports every method.

## Run the reusable scripts

Node.js 24 and `npm ci` are required. The `react-server` condition enables the installed `server-only` marker for terminal scripts. In Next.js, the same marker prevents accidental imports into a Client Component.

```zsh
# Preview the fixed seed plan; no network calls or writes:
node --conditions=react-server --env-file=.env.local scripts/seed-nessie.mts

# Read API-backed data, normalized for the UI (read-only):
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts college
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts twenties-a
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts twenties-b
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts midlife
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts older
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts teen-low-cash
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts college-shortfall
node --conditions=react-server --env-file=.env.local scripts/read-nessie-demo.mts existing-debt

# Already performed for this key. Use only to fill missing seed records or seed another key:
node --conditions=react-server --env-file=.env.local scripts/seed-nessie.mts --apply
```

`--apply` looks up markers before creating each record, verifies saved fields with GET requests, and stops on mismatches. It does not automatically retry failed writes or delete existing records. A rerun after this seed sent **zero write requests**. Keep one teammate responsible for seeding: local lock files prevent concurrent runs on one machine, but there is no cross-machine API lock/idempotency guarantee.

The ignored [local receipt](data/nessie-demo/receipt.local.json) contains created/matched IDs and verified balances, never a key. Teammates using the same key can discover the records through the reader without this file. A new key may expose different customers/data; do not copy a receipt across keys. If a process is forcibly killed, inspect the API and remove `data/nessie-demo/seed.local.lock` only after confirming no seed is running. Read-back failure means inspect first, not blindly repeat a POST.

The dates deliberately remain fixed so reruns do not create another set of records. When rolling the demo forward, update dates and expectations together in a separately reviewed seed version.

Node may print `MODULE_TYPELESS_PACKAGE_JSON` because the existing project does not declare an ESM package type. Node 24 still runs these ESM helpers; it is not an API failure. We have not changed the entire project's module format to silence it.

## Example: call the original helper functions from code

[src/nessieApi.js](src/nessieApi.js) retains the original helper names and now delegates to typed, server-only [src/lib/nessie-api.ts](src/lib/nessie-api.ts). The key comes from `.env.local`, never a source-code constant. Amount arguments here are **raw API units**, for compatibility with the original helpers.

The seed script itself is a working, executed example of `createCustomer`, `createAccount`, `createDeposit`, `createWithdrawal`, and `createBill`. Here is a smaller example you can run later. **It adds one extra $25 demo deposit** outside the fixed 32-record seed; it has not been run as part of this task.

```zsh
node --conditions=react-server --env-file=.env.local --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { getAccountDeposits, createDeposit } from './src/nessieApi.js';

const receipt = JSON.parse(await readFile('data/nessie-demo/receipt.local.json', 'utf8'));
const profile = receipt.profiles.find(person => person.slug === 'college');
const accountId = profile.accounts.find(account => account.role === 'checking').id;
const description = 'manual-demo/tutoring-2026-10-17 | SYNTHETIC';
const existing = await getAccountDeposits(accountId);

// $25 = 2,500 cents locally; our seed convention writes 25 raw Nessie units.
if (!existing.some(row => row.description === description)) {
  await createDeposit(accountId, 2500 / 100, description, '2026-10-17');
}
console.log(await getAccountDeposits(accountId));
JS
```

Use `createBill(accountId, payee, nickname, amount, '2026-11-01', 'recurring', 1)` for a bill schedule, or `createWithdrawal(accountId, amount, description, '2026-10-17')` for a balance withdrawal. Dates are calendar strings. Do not import these helpers into a `"use client"` component. Later, an authorized server route can call them and return a safe result; the browser calls your route, not Nessie with a key.

## Money, balances, and what the API does not model

The current spec describes integer balances/transaction amounts but does not explicitly establish currency units. **Our seed defines one raw API unit as one USD, only for our tagged synthetic records.** Local data and calculations use integer cents. For example, $92 is `9200` locally and `92` in this seed's API body. The adapter applies this convention only to tagged seed accounts. Do not assume it applies to every pre-existing account or another API version.

Observed during this seed: creating completed deposits/withdrawals did **not** change the accounts' `balance` fields. The supplied checking/savings balances are explicit **end-of-day snapshots as of 2026-10-17**. They are not computed by summing this sparse history. The adapter never replays historical transactions into the future forecast. It also excludes credit-card balances from available cash.

The [current official OpenAPI spec](https://prod.nessieisreal.com/nessie-openapi-spec.yaml) has no documented purchase creation/list route. The [documentation's withdrawal example](https://prod.nessieisreal.com/docs) supplied the fields used here, and we verified their persisted values with actual POST/GET requests. We therefore created **withdrawals**, not native merchant purchase records. The fixture adapter projects these withdrawals into purchase-shaped examples for the cash-back UI. It does not represent actual card charges or a full credit-card statement.

Nessie's `rewards` field is not a reward-rate schedule or card-product identity. Seed credit-card accounts have zero balance/rewards and a nickname containing the sample library card ID. Product rules, card assignments for spending, goals, income recurrence, and estimated everyday spending are explicitly local demo assumptions. The existing-debt profile also has a verified Nessie loan. Its `amount` represents outstanding principal by this synthetic dataset's convention. Account creation requires a nonnegative balance, so we store cash and the liability separately; future negative calendar balances are computed forecasts, not negative balances posted to Nessie. Interest and amortization are not modeled.

## Use these records in the features

The read-only [loadNessieDemo](src/lib/nessie-demo.ts) adapter returns:

| Returned field | Intended use |
| --- | --- |
| `customer` | Existing API name and customer ID; no address/account number exposure |
| `cashBack` | Existing `CashBackData` contract: API-backed amounts/dates joined to synthetic card assignments |
| `scenario` | Existing big-purchase/calendar `Scenario`: account snapshots, future bills, assumed income/spending |
| `goal` | A separate draft hypothetical goal; never posted to Nessie |
| `history` | The four seeded historical transactions for this person |
| `isFixture`, `sourceLabel` | Keep these visible in the UI |

The pages are now connected through the active-profile cookie. Open **Profile → Change app user** and choose any of the eight profiles. The dropdown is generated from the plan, so no second hardcoded list is needed. Home, Calendar, Forecast Fund, Swipe and Shine, Storm Solver, and Purchase Advisor refresh their data for that selection. The rewards page and home preview use explicit monthly budgets in `monthlySpendingByCategory`; these are estimates, not annualizations of the sparse transaction history. Card preferences remain separate per profile.

The added profiles exercise distinct cases:

- **19: small cash cushion** starts with $100 combined cash, receives $140 every two weeks, and pays phone/transit bills. In the first 31 calendar days, nine days are below $100 while the balance remains nonnegative.
- **21: rent before payday** starts with $250, owes $650 rent on October 22, and receives $550 on October 30. The calendar first goes negative on October 22 and briefly recovers to $25.77 on October 30, dips below zero again on October 31, and recovers after the November 13 payday.
- **24: existing loan debt** starts with $60 cash and a $1,500 personal loan, giving a cash-minus-debt position of -$1,440. A debt summary appears on the home and feature pages; the $75 loan payment appears once in the calendar on October 22. The cash forecast also shows the effect of rent before payday.

Keep `isFixture: true` visible. Posted history is included in the snapshot and is never replayed into the forecast. Hypothetical goal edits never create withdrawals. Missing API records produce visible errors instead of falling back silently. The cookie selects a demo persona; it is not authentication for real users.

Concrete feature checks under the repository's **repository card catalog rules**:

- Student: a $92 Publix trip on `everyday-1` maps to the catalog's 1.5% card and earns $1.38 versus $2.76 on the card mapped from `market-fresh`: **$1.38 potential improvement**. Covered by an offline test.
- Commuter: the gas purchase and its owned cards exercise category matching; see the current catalog for the mapped benefit rules.
- Household: $235 groceries offers a comparison between `steady-2` and `grocery-max`; the latter's annual fee still matters in any new-card advice.
- Big purchase: the student, renter, and commuter need saving time under the supplied scenarios; the household and semi-retired examples can afford the goals while preserving the configured buffers. Tests run these inputs through the existing engine.
- Use 30/60/90-day cash-back windows to see the sparse history change. Three spending examples per person are not enough for reliable annual savings estimates. A separate larger fixture is needed to test cap exhaustion or infer recurring behavior.

A practical next work session: spend the first hour testing the eight profiles across pages; the next hour refine the synthetic schedules and budgets with the team; then spend 1–2 hours testing profile selection, empty/error states, cents/date handling, deadline changes, and a teammate's setup. Add UI writes only after those reads work.

## Fix for the missing next-themes module

`next-themes` was already in both `package.json` and the lockfile. Running `npm ci` restored the missing local installation; no new dependency or version change was needed. The production build and a request to the existing local home page then succeeded.

On a teammate's machine, stop the dev server, run `npm ci`, then `npm run dev` again. This follows the [Next.js module-not-found guidance](https://nextjs.org/docs/messages/module-not-found) for a missing installed package. npm's ESLint deprecation and audit notices are separate from this resolution error; do not use `npm audit fix --force` as a fix for it.

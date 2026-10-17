# Nessie API quick reference

**2026-10-17 update:** Eight synthetic profiles, 32 historical transactions, 17 recurring bills, and one loan are now seeded. The Profile dropdown selects the API-backed data used across the home, calendar, forecast, rewards, and advisor pages. See [the seeded-data guide](NESSIE-DEMO-DATA.md) for commands and the three low-balance/debt scenarios. Earlier empty-data observations and connection plans below describe the pre-integration state.

Checked October 17, 2026. Start here; use [API-guide.md](API-guide.md) for explanations, schemas, team workflow, and page integration.

## Connection essentials

| Item | Value / rule |
| --- | --- |
| What Nessie is | Capital One's hackathon API for **mock banking data** |
| Documentation | [Interactive docs](https://prod.nessieisreal.com/docs) |
| API base URL | `https://prod-api.nessieisreal.com` |
| Authentication | Query parameter `key`, added **on the server** to every upstream request |
| Read example | `GET /accounts?key=<server-only-key>` |
| Request/response format | JSON; `Accept: application/json`; JSON writes also use `Content-Type: application/json` |
| Account identifier | Copy the returned `_id`, not `account_number` or `customer_id` |
| App backend | `src/lib/nessie.ts` and `src/app/api/dashboard/route.ts` |
| Browser's API | `/api/dashboard`, with no Nessie key in the browser |
| Money / dates inside our app | Integer cents; validated `YYYY-MM-DD` calendar dates |

**The docs website and the API are different hosts.** Use the HTTPS API base above. The older `http://api.nessieisreal.com` value currently in local configuration should be replaced; this guide's live checks used the current HTTPS host. Never add `NEXT_PUBLIC_` to a Nessie variable.

## What is verified now?

Read-only checks with the supplied key returned HTTP 200: **3 customers, 1 Checking account**, and **0 bills, deposits, withdrawals, or loans** for that account. The single-account read also succeeded. This is a dated observation, not a promise that the data will stay unchanged. No records were created, changed, or deleted.

The web app uses **API-backed synthetic fixtures** through `/api/demo-data`. Its older `/api/dashboard` only reports configuration and `connected: false`; use the selected-profile route to check the current integration. Local setup was subsequently corrected to use HTTPS and the verified Checking account. Teammates must configure their own ignored environment files.

## Run a safe API test

Use Node.js 24. In the repo root, create `.env.local` from `.env.example` if needed. Preserve any existing local key; fill in:

```dotenv
NESSIE_API_KEY=<get privately from the key owner>
NESSIE_BASE_URL=https://prod-api.nessieisreal.com
NESSIE_ACCOUNT_ID=
```

Then run:

```bash
node --env-file=.env.local scripts/nessie-smoke.mts customers
node --env-file=.env.local scripts/nessie-smoke.mts accounts
```

Copy the desired account's `sample[].id` into `NESSIE_ACCOUNT_ID` in `.env.local`, then:

```bash
node --env-file=.env.local scripts/nessie-smoke.mts account
node --env-file=.env.local scripts/nessie-smoke.mts bills
```

Other resources: `deposits`, `withdrawals`, `loans`. Run `node scripts/nessie-smoke.mts --help` for usage. No running Next.js server is required. The script sends only GETs, prints a limited summary, refuses other hosts/redirects, and exits nonzero on errors. It performs a limited shape check, not full business validation. `count: 0` is a successful empty result. `npm test` remains the offline test suite.

## Endpoints to use first

All paths below are relative to the API base and require `?key=...` on the server. `{id}` is a placeholder, not literal text.

| Method and path | Use |
| --- | --- |
| `GET /customers` | Discover customers accessible to this key |
| `GET /customers/{id}/accounts` | List one customer's accounts; here `id` is a customer ID |
| `GET /accounts` | Discover all accessible accounts |
| `GET /accounts/{id}` | Read the chosen account and balance |
| `GET /accounts/{id}/bills` | Read bill records; validate status/dates before forecasting |
| `GET /accounts/{id}/deposits` | Inspect deposits; past payroll does not guarantee another payday |
| `GET /accounts/{id}/withdrawals` | Inspect withdrawals; avoid counting posted spending again |
| `GET /accounts/{id}/loans` | Optional debt context; a monthly amount alone is not a due-date schedule |

Additional documented resources: customers, merchants, ATMs, branches, purchases, transfers, and enterprise reads. See the [full endpoint inventory](API-guide.md#5-endpoint-inventory).

## Schema traps

- **IDs:** the schema specifies 24 characters, but the live account/customer IDs observed are UUIDs (36 characters). Treat IDs as opaque strings. The test script accepts both formats.
- **Money:** the schema calls `balance` an integer and `payment_amount` a float, but does not explicitly specify dollars versus cents. Confirm upstream units before implementing conversion. Integer does not mean cents.
- **Paths:** single-item reads use `/purchase/{purchase_id}` and `/withdrawal/{withdrawal_id}` (singular), but `/transfers/{transfer_id}` (plural). Do not infer paths from older examples.
- The current spec does **not** list account purchase/transfer collection or creation routes. Their absence does not prove they cannot exist; get authoritative confirmation before implementing them.
- The ATM schema reference is unresolved; merchant `category` is a string in the schema but an array in the overview example. Inspect live responses before using either.

## Team rules and first milestone

Teammates using the same key access the same sandbox permissions and data. Git branches do not isolate that data. Share the key privately, keep separate ignored `.env.local` files, choose one demo account, and give one person responsibility for any seed/reset writes. Use separate keys for independent experiments when needed; account IDs are not automatically portable between keys.

1. Integrator verifies the imported `/big-purchase` and `/cash-back` pages and connects navigation.
2. Nessie owner verifies the account, units, and response shapes; implements server-only reads.
3. Team agrees on the shared dashboard contract before editing `src/lib/types.ts`.
4. Connect one balance card, including loading/error/fixture labels.
5. Forecast owner adds confirmed future schedules and seven deterministic days; calendar owner displays them.
6. Extend to 30 days and a local hypothetical purchase simulation. Simulating a purchase must not create a Nessie purchase or withdrawal.

Keep completed historical activity out of a forecast that starts from a balance already reflecting that activity. Show confirmed schedules, estimates, and hypothetical scenarios separately.

## Troubleshooting and checks

| Result | Next action |
| --- | --- |
| Configuration-only success | It proves variables exist, not connectivity |
| HTTP 401 / 403 | Check key, environment, and access with the owner |
| HTTP 404 | Check host, exact path, and the resource ID under this key |
| HTTP 400 | Check required parameters, enums, types, and JSON body |
| Empty array | Add deliberate demo data later, or use clearly labeled app fixtures |
| Invalid JSON / schema mismatch | Stop parsing; inspect the current schema and a redacted response |
| Network / timeout / 5xx | Show an API error and retry deliberately; do not silently substitute fixtures |

Before merging relevant code: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Sources: [official OpenAPI specification](https://prod.nessieisreal.com/nessie-openapi-spec.yaml), [getting started](https://prod.nessieisreal.com/getting-started), the supplied PDFs, and the dated read-only checks described above. Detailed source notes and remaining questions are in [the guide](API-guide.md#sources-and-verification-notes).

import type { SpendingCategoryId } from "../spending-categories";

/**
 * EDIT HERE. How each seeded persona spends, for the six-month Nessie history (seed v2). Amounts are
 * whole dollars, stored in cents. Each persona's spending budgets add up to its plan's
 * estimatedMonthlySpendingCents, so the forecast's monthly spending total does not change; only
 * the breakdown becomes detailed. Money left over after bills and spending (the plan's incomes are
 * higher than its outgoings) leaves through labeled savings, one-off costs, and the monthly "sweep",
 * so balances six months ago stay close to today's. Merchants are real chains for realism; amounts
 * and visits are fictional.
 */

export interface SpendRule {
  category: SpendingCategoryId;
  /** Average monthly budget. */
  monthlyCents: number;
  /** Purchases a month, on average. Ignored for fixed subscriptions. */
  perMonth: number;
  merchants: string[];
  /** Same charge on the same day every month (subscriptions). Their sum must equal monthlyCents. */
  fixed?: { label: string; cents: number; day: number }[];
  /** Mostly Fridays to Sundays. */
  weekend?: boolean;
  /** Only between these month-day pairs, inclusive ("08-01"). */
  season?: { from: string; to: string }[];
}

export interface OneOff {
  date: string;
  category: SpendingCategoryId;
  label: string;
  cents: number;
}

export interface PersonaHistory {
  slug: string;
  paycheckLabel: string;
  /** Hourly pay varies by up to this fraction; the six-month average stays at the plan amount. */
  paycheckVariation: number;
  spend: SpendRule[];
  oneOffs: OneOff[];
  /** Monthly checking-to-savings transfer. */
  savingsTransfer?: { cents: number; day: number };
  /** Monthly savings interest, paid on the last day of the month. */
  savingsInterestCents?: number;
  /** Fixed monthly contributions to accounts outside the app (retirement, college savings). */
  contributions?: { label: string; cents: number; day: number }[];
  /** Where the rest of the monthly surplus goes, once a month after a payday. */
  sweep: { label: string; tag: "saving" | "one-off"; category?: SpendingCategoryId };
  /** Lowest checking balance allowed on any past day. */
  floorCents: number;
  /** Checking balance at the start of the window when it differs from today's (rent due before the first payday). */
  startCheckingCents?: number;
}

const $ = (dollars: number) => dollars * 100;
const AUG_SEP = [{ from: "08-01", to: "09-20" }];

export const PERSONAS: PersonaHistory[] = [
  {
    slug: "college",
    startCheckingCents: $(900),
    paycheckLabel: "Campus library paycheck",
    paycheckVariation: 0.08,
    spend: [
      { category: "groceries", monthlyCents: $(180), perMonth: 4, merchants: ["Publix", "Publix", "Aldi"] },
      { category: "dining", monthlyCents: $(42), perMonth: 3, merchants: ["Chipotle", "Campus food court", "Domino's Pizza", "Chick-fil-A"], weekend: true },
      { category: "coffee", monthlyCents: $(18), perMonth: 3, merchants: ["Starbucks", "Dunkin'"] },
      { category: "transit", monthlyCents: $(40), perMonth: 3, merchants: ["Uber", "Lyft", "Uber"] },
      { category: "school", monthlyCents: $(26), perMonth: 0.2, merchants: ["Lab notebooks and pens"], season: AUG_SEP },
      { category: "streaming", monthlyCents: $(6), perMonth: 1, merchants: [], fixed: [{ label: "Spotify Premium Student", cents: $(6), day: 12 }] },
      { category: "amazon", monthlyCents: $(8), perMonth: 0.34, merchants: ["Amazon"] },
    ],
    oneOffs: [
      { date: "2026-05-12", category: "education", label: "Summer session fees", cents: $(600) },
      { date: "2026-06-03", category: "travel", label: "Southwest flight home", cents: $(260) },
      { date: "2026-08-14", category: "education", label: "Fall tuition and fees", cents: $(1_150) },
    ],
    savingsTransfer: { cents: $(25), day: 26 },
    sweep: { label: "Venmo to roommates", tag: "one-off", category: "other" },
    floorCents: $(40),
  },
  {
    slug: "twenties-a",
    paycheckLabel: "Design studio paycheck",
    paycheckVariation: 0,
    spend: [
      { category: "groceries", monthlyCents: $(300), perMonth: 5, merchants: ["Trader Joe's", "Publix", "Trader Joe's"] },
      { category: "dining", monthlyCents: $(150), perMonth: 4, merchants: ["Local sushi bar", "Thai restaurant", "Neighborhood bistro", "Uber Eats"], weekend: true },
      { category: "coffee", monthlyCents: $(50), perMonth: 5, merchants: ["Starbucks", "Local coffee shop"] },
      { category: "entertainment", monthlyCents: $(50), perMonth: 1.5, merchants: ["AMC Theatres", "Concert tickets", "Bowling night"], weekend: true },
      {
        category: "streaming", monthlyCents: $(30), perMonth: 2, merchants: [],
        fixed: [{ label: "Netflix", cents: $(18), day: 3 }, { label: "Spotify Premium", cents: $(12), day: 15 }],
      },
      { category: "transit", monthlyCents: $(70), perMonth: 4, merchants: ["Uber", "Lyft"] },
    ],
    oneOffs: [
      { date: "2026-06-05", category: "travel", label: "United flights to Chicago", cents: $(340) },
      { date: "2026-06-05", category: "travel", label: "Airbnb in Chicago", cents: $(420) },
      { date: "2026-09-12", category: "gifts", label: "Wedding gift", cents: $(150) },
    ],
    savingsTransfer: { cents: $(100), day: 26 },
    contributions: [{ label: "Roth IRA contribution (Vanguard)", cents: $(500), day: 5 }],
    sweep: { label: "Transfer to brokerage (Fidelity)", tag: "saving" },
    floorCents: $(300),
  },
  {
    slug: "twenties-b",
    paycheckLabel: "Technical support paycheck",
    paycheckVariation: 0,
    spend: [
      { category: "groceries", monthlyCents: $(260), perMonth: 4, merchants: ["Aldi", "Aldi", "Walmart groceries"] },
      { category: "gas", monthlyCents: $(180), perMonth: 5, merchants: ["Shell", "RaceTrac", "Wawa"] },
      { category: "auto", monthlyCents: $(90), perMonth: 0.5, merchants: ["Valvoline oil change", "Car wash", "AutoZone wiper blades"] },
      { category: "dining", monthlyCents: $(30), perMonth: 3, merchants: ["McDonald's", "Taco Bell", "Wendy's"] },
      { category: "streaming", monthlyCents: $(15), perMonth: 1, merchants: [], fixed: [{ label: "Netflix", cents: $(15), day: 9 }] },
      { category: "amazon", monthlyCents: $(20), perMonth: 1, merchants: ["Amazon"] },
      { category: "personal_care", monthlyCents: $(5), perMonth: 0.17, merchants: ["Great Clips"] },
    ],
    oneOffs: [
      { date: "2026-05-20", category: "insurance", label: "Car insurance, 6-month premium", cents: $(720) },
      { date: "2026-07-03", category: "travel", label: "Holiday road trip hotel", cents: $(210) },
      { date: "2026-07-15", category: "auto", label: "Vehicle registration renewal", cents: $(85) },
    ],
    savingsTransfer: { cents: $(100), day: 26 },
    contributions: [{ label: "Roth IRA contribution (Schwab)", cents: $(400), day: 6 }],
    sweep: { label: "Transfer to brokerage (Fidelity)", tag: "saving" },
    floorCents: $(300),
  },
  {
    slug: "midlife",
    paycheckLabel: "Operations paycheck",
    paycheckVariation: 0,
    spend: [
      { category: "groceries", monthlyCents: $(650), perMonth: 6, merchants: ["Publix", "Publix", "Aldi", "Walmart Supercenter groceries"] },
      { category: "gas", monthlyCents: $(200), perMonth: 5, merchants: ["Chevron", "Shell", "RaceTrac"] },
      { category: "household", monthlyCents: $(90), perMonth: 1.5, merchants: ["Home Depot", "Target household", "Lowe's"] },
      {
        category: "streaming", monthlyCents: $(35), perMonth: 2, merchants: [],
        fixed: [{ label: "Netflix", cents: $(23), day: 4 }, { label: "Disney+", cents: $(12), day: 18 }],
      },
      { category: "dining", monthlyCents: $(60), perMonth: 2, merchants: ["Olive Garden", "Chick-fil-A", "Domino's Pizza"], weekend: true },
      { category: "drugstores", monthlyCents: $(25), perMonth: 1.5, merchants: ["CVS", "Walgreens"] },
      { category: "clothing", monthlyCents: $(40), perMonth: 1, merchants: ["Old Navy", "Target clothing", "Kohl's"] },
    ],
    oneOffs: [
      { date: "2026-06-02", category: "insurance", label: "Car insurance, 6-month premium", cents: $(1_100) },
      { date: "2026-06-10", category: "education", label: "Kids' summer camp", cents: $(900) },
      { date: "2026-07-18", category: "travel", label: "Family beach weekend hotel", cents: $(640) },
      { date: "2026-08-08", category: "school", label: "Back-to-school clothes and supplies", cents: $(350) },
      { date: "2026-09-16", category: "health", label: "Family dentist visit", cents: $(180) },
    ],
    savingsTransfer: { cents: $(500), day: 27 },
    savingsInterestCents: $(28),
    contributions: [{ label: "529 college savings contribution", cents: $(400), day: 8 }],
    sweep: { label: "Transfer to brokerage (Vanguard)", tag: "saving" },
    floorCents: $(1_500),
  },
  {
    slug: "older",
    paycheckLabel: "Monthly pension and part-time income",
    paycheckVariation: 0,
    spend: [
      { category: "groceries", monthlyCents: $(400), perMonth: 4, merchants: ["Kroger", "Publix"] },
      { category: "dining", monthlyCents: $(150), perMonth: 3, merchants: ["Local restaurant", "Cracker Barrel", "Panera Bread"] },
      { category: "drugstores", monthlyCents: $(100), perMonth: 2, merchants: ["CVS", "Walgreens"] },
      { category: "streaming", monthlyCents: $(12), perMonth: 1, merchants: [], fixed: [{ label: "Paramount+", cents: $(12), day: 11 }] },
      { category: "gifts", monthlyCents: $(40), perMonth: 1, merchants: ["Grandkids' birthday gift", "Hallmark cards and gifts"] },
      { category: "household", monthlyCents: $(28), perMonth: 0.5, merchants: ["Lowe's garden center", "Ace Hardware"] },
      { category: "personal_care", monthlyCents: $(20), perMonth: 0.5, merchants: ["Hair salon"] },
    ],
    oneOffs: [
      { date: "2026-04-28", category: "insurance", label: "Annual car insurance", cents: $(1_150) },
      { date: "2026-05-08", category: "travel", label: "Delta flights to visit family", cents: $(480) },
      { date: "2026-08-20", category: "health", label: "Dental crown", cents: $(650) },
    ],
    savingsTransfer: { cents: $(300), day: 25 },
    savingsInterestCents: $(47),
    sweep: { label: "Transfer to brokerage (Schwab)", tag: "saving" },
    floorCents: $(800),
  },
  {
    slug: "teen-low-cash",
    paycheckLabel: "Weekend cafe paycheck",
    paycheckVariation: 0.1,
    spend: [
      { category: "groceries", monthlyCents: $(110), perMonth: 4, merchants: ["Aldi", "Aldi", "Publix"] },
      { category: "dining", monthlyCents: $(30), perMonth: 4, merchants: ["Chipotle", "McDonald's", "Taco Bell"], weekend: true },
      { category: "school", monthlyCents: $(10), perMonth: 0.17, merchants: ["Notebooks and binders"], season: AUG_SEP },
      { category: "entertainment", monthlyCents: $(15), perMonth: 1, merchants: ["Movie ticket", "Bowling with friends"], weekend: true },
      { category: "clothing", monthlyCents: $(20), perMonth: 0.5, merchants: ["Goodwill thrift", "Old Navy"] },
      { category: "drugstores", monthlyCents: $(15), perMonth: 1, merchants: ["Walgreens", "CVS"] },
    ],
    oneOffs: [
      { date: "2026-06-20", category: "entertainment", label: "Concert ticket", cents: $(60) },
      { date: "2026-08-09", category: "gifts", label: "Birthday gift for a friend", cents: $(25) },
    ],
    sweep: { label: "ATM cash withdrawal", tag: "one-off", category: "other" },
    floorCents: $(5),
  },
  {
    slug: "college-shortfall",
    startCheckingCents: $(1_050),
    paycheckLabel: "Campus dining paycheck",
    paycheckVariation: 0.08,
    spend: [
      { category: "groceries", monthlyCents: $(200), perMonth: 5, merchants: ["Publix", "Aldi"] },
      { category: "transit", monthlyCents: $(50), perMonth: 2, merchants: ["City bus pass reload", "City bus pass reload", "Uber"] },
      { category: "dining", monthlyCents: $(30), perMonth: 3, merchants: ["Chipotle", "Campus food court"] },
      { category: "school", monthlyCents: $(15), perMonth: 0.17, merchants: ["Blue books and pens"], season: AUG_SEP },
      { category: "drugstores", monthlyCents: $(5), perMonth: 0.17, merchants: ["CVS"] },
    ],
    oneOffs: [
      { date: "2026-05-08", category: "education", label: "Summer course fee", cents: $(250) },
      { date: "2026-07-02", category: "travel", label: "Greyhound bus to visit family", cents: $(95) },
    ],
    sweep: { label: "ATM cash withdrawal", tag: "one-off", category: "other" },
    floorCents: $(20),
  },
  {
    slug: "existing-debt",
    startCheckingCents: $(900),
    paycheckLabel: "Retail paycheck",
    paycheckVariation: 0.1,
    spend: [
      { category: "groceries", monthlyCents: $(230), perMonth: 5, merchants: ["Aldi", "Walmart groceries"] },
      { category: "transit", monthlyCents: $(60), perMonth: 3, merchants: ["City bus pass reload", "Uber"] },
      { category: "dining", monthlyCents: $(30), perMonth: 2, merchants: ["McDonald's", "Taco Bell"] },
      { category: "drugstores", monthlyCents: $(15), perMonth: 0.34, merchants: ["CVS"] },
      { category: "personal_care", monthlyCents: $(15), perMonth: 0.34, merchants: ["Great Clips"] },
    ],
    oneOffs: [
      { date: "2026-06-14", category: "other", label: "Phone screen repair", cents: $(120) },
      { date: "2026-08-04", category: "health", label: "Urgent care copay", cents: $(75) },
    ],
    sweep: { label: "Sent to family (Zelle)", tag: "one-off", category: "family" },
    floorCents: $(10),
  },
];

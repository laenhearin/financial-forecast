/** Integer-cent helpers. Amounts are whole cents; dollars appear only at input and display boundaries. */

export function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function assertCents(value: number, label = "Amount"): void {
  if (!isCents(value)) throw new Error(`${label} must be safe integer cents.`);
}

/** Converts an authored dollar amount (for example 15.49) to cents once, at the data boundary. */
export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars)) throw new Error("Dollar amount must be a finite number.");
  const cents = Math.round(dollars * 100);
  assertCents(cents, "Dollar amount");
  return cents;
}

/**
 * Parses user-typed dollars ("1,800", "$12.5", "0.07") without floating-point math.
 * Returns null for anything that is not a nonnegative amount with at most two decimals.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return isCents(cents) ? cents : null;
}

const wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** "$1,800" for whole dollars, "$15.49" otherwise. */
export function formatUSD(cents: number): string {
  assertCents(cents);
  return cents % 100 === 0 ? wholeDollars.format(cents / 100) : withCents.format(cents / 100);
}

/** Plain-number dollars for input fields: 180000 -> "1800", 1549 -> "15.49". */
export function centsToInputString(cents: number): string {
  assertCents(cents);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const rest = abs % 100;
  return `${sign}${Math.floor(abs / 100)}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}

export function roundDownToStep(cents: number, step: number): number {
  return Math.floor(cents / step) * step;
}

export function roundUpToStep(cents: number, step: number): number {
  return Math.ceil(cents / step) * step;
}

/** Percent of an amount, rounded to the nearest cent. */
export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

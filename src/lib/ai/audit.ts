/**
 * Number audit: catches the model stating a dollar figure that is not in the facts it was given.
 * Money is recognized as "$1,234.56", "$15k", "1,234 dollars" and "USD 1,234" or "1,234 USD".
 * Percentages, day counts and dates are not checked, and a figure that does appear in the facts
 * passes even if it is attached to the wrong thing: this narrows unsupported numbers, it does not
 * prove an explanation correct.
 */
const NUMBER = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const AMOUNT_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`\$\s?${NUMBER}(\s?[kK]\b)?`, "g"),
  new RegExp(String.raw`\b${NUMBER}(\s?[kK])?\s?(?:dollars?|bucks|USD)\b`, "gi"),
  new RegExp(String.raw`\bUSD\s?${NUMBER}(\s?[kK]\b)?`, "gi"),
];
/** Whole-dollar rounding of a fact ($1,234.56 written as $1,235) still passes. */
const TOLERANCE_DOLLARS = 0.5;

export interface AuditResult { ok: boolean; flags: string[] }

/** `allowed` holds the prompt payloads (dollars), for example facts, the baseline and tool results. */
export function auditNumbers(text: string, allowed: readonly unknown[]): AuditResult {
  const values = new Set<number>([0]);
  for (const payload of allowed) collectNumbers(payload, values);
  const known = [...values];
  const flags: string[] = [];
  const matches = AMOUNT_PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)]).sort((a, b) => a.index - b.index);
  let checkedThrough = -1;
  for (const match of matches) {
    // "$15 USD" matches two patterns over the same text; check it once.
    if (match.index < checkedThrough) continue;
    checkedThrough = match.index + match[0].length;
    const amount = Number(match[1].replace(/,/g, "")) * (match[2] ? 1_000 : 1);
    if (!Number.isFinite(amount)) continue;
    if (!known.some((value) => Math.abs(Math.abs(value) - amount) <= TOLERANCE_DOLLARS)) {
      const flag = `unknown amount ${match[0].trim()}`;
      if (!flags.includes(flag)) flags.push(flag);
    }
  }
  return { ok: flags.length === 0, flags };
}

/** Numeric leaves, plus numbers written inside strings (labels such as "BELOW $0" or "$1,800 rent"). */
function collectNumbers(value: unknown, into: Set<number>): void {
  if (typeof value === "number" && Number.isFinite(value)) into.add(value);
  else if (typeof value === "string") {
    for (const match of value.matchAll(/\d[\d,]*(?:\.\d+)?/g)) into.add(Number(match[0].replace(/,/g, "")));
  } else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, into));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectNumbers(item, into));
}

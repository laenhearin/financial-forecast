/**
 * Number audit: catches the model stating a dollar figure that is not in the facts it was given.
 * Only "$"-prefixed amounts are checked; percentages, day counts and dates are not (v1).
 */
const DOLLAR_PATTERN = /\$\s?(\d[\d,]*(?:\.\d+)?)/g;
/** Whole-dollar rounding of a fact ($1,234.56 written as $1,235) still passes. */
const TOLERANCE_DOLLARS = 0.5;

export interface AuditResult { ok: boolean; flags: string[] }

/** `allowed` holds the prompt payloads (dollars), for example facts, the baseline and tool results. */
export function auditNumbers(text: string, allowed: readonly unknown[]): AuditResult {
  const values = new Set<number>([0]);
  for (const payload of allowed) collectNumbers(payload, values);
  const known = [...values];
  const flags: string[] = [];
  for (const match of text.matchAll(DOLLAR_PATTERN)) {
    const amount = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(amount)) continue;
    if (!known.some((value) => Math.abs(Math.abs(value) - amount) <= TOLERANCE_DOLLARS)) {
      const flag = `unknown amount $${match[1]}`;
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

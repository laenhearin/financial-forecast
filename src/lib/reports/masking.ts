export function maskAccountNumber(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (/^[*•]+\s*\d{4}$/.test(value)) return `****${digits}`;
  return digits.length > 4 ? `****${digits.slice(-4)}` : "****";
}
/** Protect free-text labels too; upstream names can contain account numbers or identifiers. */
export function safeLabel(value: string): string {
  return value.replace(/\b[0-9a-f]{24}\b/gi, "****")
    .replace(/\d(?:[ -]?\d){4,}/g, match => maskAccountNumber(match));
}

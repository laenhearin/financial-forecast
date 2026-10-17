/**
 * Structured-output schemas and the validators that clean model output. The schemas use only JSON
 * Schema keywords the Gemini structured-output guide documents (type, properties, required, items,
 * maxItems, enum, ["string", "null"]); length limits are enforced here instead.
 */
import type { AdvisorExplanation } from "./types";

export const ADVISOR_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "At most 80 characters." },
    explanation: { type: "string", description: "Two to four plain-language sentences." },
    alternative: { type: ["string", "null"], description: "One concrete suggestion, or null." },
  },
  required: ["headline", "explanation", "alternative"],
};

export const GOAL_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Two or three plain-language sentences." },
  },
  required: ["summary"],
};

const LIMITS = { headline: 80, explanation: 600, alternative: 240, summary: 600 };

export function parseAdvisorExplanation(data: unknown): AdvisorExplanation | null {
  if (typeof data !== "object" || data === null) return null;
  const { headline, explanation, alternative } = data as Record<string, unknown>;
  const cleanHeadline = clean(headline, LIMITS.headline);
  const cleanExplanation = clean(explanation, LIMITS.explanation);
  if (!cleanHeadline || !cleanExplanation) return null;
  if (alternative === null || alternative === undefined || (typeof alternative === "string" && !alternative.trim())) {
    return { headline: cleanHeadline, explanation: cleanExplanation, alternative: null };
  }
  const cleanAlternative = clean(alternative, LIMITS.alternative);
  return cleanAlternative ? { headline: cleanHeadline, explanation: cleanExplanation, alternative: cleanAlternative } : null;
}

export function parseGoalSummary(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  return clean((data as Record<string, unknown>).summary, LIMITS.summary);
}

/** Plain text only: strips markdown emphasis and collapses whitespace. Null when empty or too long. */
export function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[*_`#]+/g, "").replace(/\s+/g, " ").trim();
  return text && text.length <= max ? text : null;
}

/** The app's six balance levels, worded without numbers (the audit only allows figures from facts). */
export const LEVEL_VOCABULARY = [
  "Balance levels, from best to worst (the app's own labels, always relative to the user's critical balance, which defaults to their rent):",
  "- THRIVING: plenty of room above the critical balance.",
  "- STABLE: comfortable room above the critical balance.",
  "- CAUTION: still above the critical balance, but the cushion is getting thin.",
  "- NEAR CRITICAL: only just above the critical balance.",
  "- CRITICAL: at or below the critical balance, so an essential bill could be at risk.",
  "- BELOW $0: the account would be overdrawn.",
  "Write the labels in lowercase inside sentences (for example \"near critical\").",
].join("\n");

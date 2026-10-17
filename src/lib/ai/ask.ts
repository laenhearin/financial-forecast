export interface AskAnswer {
  text: string;
  verdict?: "safe" | "risky" | "not-advisable"; // for later; the UI ignores it for now
}

const STUB_DELAY_MS = 800;

export const STUB_ANSWER_TEXT =
  "AI answers are not connected yet. This is where the explanation of how your question affects your forecast will appear.";

/**
 * The only way the UI asks a question.
 * STUB: waits briefly, then returns a clearly labeled placeholder.
 * Later: replace the body with a fetch to the LLM server route.
 */
export async function askQuestion(question: string): Promise<AskAnswer> {
  if (!question.trim()) throw new Error("Question is empty.");
  await new Promise((resolve) => setTimeout(resolve, STUB_DELAY_MS));
  return { text: STUB_ANSWER_TEXT };
}

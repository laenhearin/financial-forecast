import "server-only";
import { buildAdvisorFacts } from "../facts/advisor";
import { buildGoalSummaryFacts } from "../facts/goalSummary";
import { advisorTemplate, goalSummaryTemplate } from "../fallbacks";
import { toPromptFacts } from "../promptJson";
import { ADVISOR_SYSTEM } from "../prompts/system-advisor";
import { GOAL_SUMMARY_SYSTEM } from "../prompts/system-goal-summary";
import { ADVISOR_SCHEMA, GOAL_SUMMARY_SCHEMA, parseAdvisorExplanation, parseGoalSummary } from "../schemas";
import type { AdvisorResponse, AskStreamEvent, Cents, GoalSummaryResponse, SavedPurchaseInput } from "../types";
import { parseAdvisorRequest, parseAskRequest, parseGoalSummaryRequest } from "../validate";
import { forecastEndDate } from "@/features/calendar/engine/entries";
import { runAsk } from "./ask";
import type { FinanceContext } from "./context";
import { generateStructured } from "./generate";
import { json, rateLimited, readJsonBody } from "./http";
import type { AiRuntime } from "./runtime";

/** Route logic, separate from route.ts so tests can inject a runtime and a context loader. */
export interface HandlerDeps {
  runtime: AiRuntime;
  loadContext: (purchases: readonly SavedPurchaseInput[], criticalBalanceCents: Cents | null) => Promise<FinanceContext>;
}

const LOAD_FAILED = "Your forecast couldn't be loaded right now. Try again in a moment.";

export async function handleAdvisor(request: Request, deps: HandlerDeps): Promise<Response> {
  const limited = rateLimited(request, deps.runtime.limiter);
  if (limited) return limited;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const input = parseAdvisorRequest(body.value);
  if (!input) return json({ status: "error", message: "Send { purchase: { label, amountCents, date, accountId } } with optional criticalBalanceCents and purchases." }, 400);

  const context = await loadOrNull(deps, input.purchases, input.criticalBalanceCents);
  if (!context) return json({ status: "error", message: LOAD_FAILED }, 503);
  const { purchase } = input;
  if (purchase.date < context.today || purchase.date > forecastEndDate(context.today) || !context.scenario.accounts.some((account) => account.id === purchase.accountId)) {
    return json({ status: "error", message: "The purchase date or account is outside this forecast." }, 400);
  }

  const facts = buildAdvisorFacts(context.scenario, context.purchases, purchase, context.criticalCents, context.entries);
  const result = await generateStructured({
    surface: "advisor",
    tier: "fast",
    system: ADVISOR_SYSTEM,
    facts: toPromptFacts(facts),
    schema: ADVISOR_SCHEMA,
    validate: parseAdvisorExplanation,
    template: () => advisorTemplate(facts),
    auditText: (value) => [value.headline, value.explanation, value.alternative ?? ""].join(" "),
    maxOutputTokens: 600,
    temperature: 0.3,
    thinking: "minimal",
  }, deps.runtime, request.signal);
  return json({ explanation: result.value, meta: result.meta } satisfies AdvisorResponse);
}

export async function handleGoalSummary(request: Request, deps: HandlerDeps): Promise<Response> {
  const limited = rateLimited(request, deps.runtime.limiter);
  if (limited) return limited;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const input = parseGoalSummaryRequest(body.value);
  if (!input) return json({ status: "error", message: "Send { goal: { name, costCents, bufferCents, contributionCents, deadline } }." }, 400);

  const context = await loadOrNull(deps, [], null);
  if (!context) return json({ status: "error", message: LOAD_FAILED }, 503);
  const facts = buildGoalSummaryFacts(context.scenario, input);
  if (!facts) return json({ status: "error", message: "This goal has no forecast yet." }, 422);

  const result = await generateStructured({
    surface: "goal-summary",
    tier: "fast",
    system: GOAL_SUMMARY_SYSTEM,
    facts: toPromptFacts(facts),
    schema: GOAL_SUMMARY_SCHEMA,
    validate: parseGoalSummary,
    template: () => goalSummaryTemplate(facts),
    auditText: (summary) => summary,
    maxOutputTokens: 400,
    temperature: 0.3,
    thinking: "minimal",
  }, deps.runtime, request.signal);
  return json({ summary: result.value, meta: result.meta } satisfies GoalSummaryResponse);
}

/** Streams AskStreamEvents as NDJSON (one JSON object per line). */
export async function handleAsk(request: Request, deps: HandlerDeps): Promise<Response> {
  const limited = rateLimited(request, deps.runtime.limiter);
  if (limited) return limited;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const input = parseAskRequest(body.value);
  if (!input) return json({ status: "error", message: "Send { question } (1 to 500 characters) with optional history, criticalBalanceCents and purchases." }, 400);

  const context = await loadOrNull(deps, input.purchases, input.criticalBalanceCents);
  if (!context) return json({ status: "error", message: LOAD_FAILED }, 503);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AskStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch { /* The browser went away; keep going so the run finishes cleanly. */ }
      };
      try {
        await runAsk(input, context, deps.runtime, emit, request.signal);
      } catch (error) {
        console.error("[ai] ask stream failed unexpectedly:", error instanceof Error ? error.name : "unknown");
        emit({ type: "error", message: "Something went wrong. Try again." });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

async function loadOrNull(deps: HandlerDeps, purchases: readonly SavedPurchaseInput[], critical: Cents | null): Promise<FinanceContext | null> {
  try {
    return await deps.loadContext(purchases, critical);
  } catch (error) {
    console.error("[ai] loading the demo profile failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

import { monthlyBill, makeScenario, paycheck } from "@/features/big-purchase/engine/testScenario";
import type { Scenario } from "@/features/big-purchase/types";
import { TtlLruCache } from "./cache";
import type { JsonRequest, LlmClient, ToolRunRequest } from "./client";
import { readAiConfig, type AiConfig } from "./config";
import { financeContext, type FinanceContext } from "./context";
import { TokenBucketLimiter } from "./ratelimit";
import type { AiRuntime } from "./runtime";

/** Test helpers only. Builds a runtime around a fake client so no test calls the network. */
export function testRuntime(client: LlmClient | null, env: Record<string, string> = {}): AiRuntime & { config: AiConfig } {
  const config = readAiConfig({ GEMINI_API_KEY: "test-key", ...env });
  let clock = 0;
  return {
    config,
    client,
    cache: new TtlLruCache(config.cacheMaxEntries, config.cacheTtlMs, () => clock),
    limiter: new TokenBucketLimiter(config.routeRateLimitPerMin, () => clock),
    sleep: async () => {},
    now: () => (clock += 5),
    requestId: () => "test",
  };
}

type JsonStep = (request: JsonRequest) => unknown;
type ToolStep = (request: ToolRunRequest) => Promise<{ text: string; model: string }>;

/** A fake client that plays scripted steps in order and records each request. */
export function fakeClient({ json = [], tools = [] }: { json?: JsonStep[]; tools?: ToolStep[] }) {
  const jsonCalls: JsonRequest[] = [];
  const toolCalls: ToolRunRequest[] = [];
  const client: LlmClient = {
    async generateJson(request) {
      jsonCalls.push(request);
      const step = json[jsonCalls.length - 1];
      if (!step) throw new Error("No scripted JSON response left.");
      return { data: await step(request), model: request.model };
    },
    async runTools(request) {
      toolCalls.push(request);
      const step = tools[toolCalls.length - 1];
      if (!step) throw new Error("No scripted tool response left.");
      return step(request);
    },
  };
  return { client, jsonCalls, toolCalls };
}

/**
 * $3,000 on Jan 1, rent of $1,200 on the 5th (the default critical balance), utilities of $100 on
 * the 15th, and a $1,500 paycheck every other Friday from Jan 9.
 */
export function testScenario(): Scenario {
  return makeScenario({
    balanceCents: 300_000,
    income: [paycheck(150_000, "2026-01-09")],
    bills: [
      monthlyBill("rent", 120_000, 5, { label: "Rent", category: "housing" }),
      monthlyBill("power", 10_000, 15, { label: "Power", category: "utilities" }),
    ],
  });
}

export function testContext(overrides: { criticalCents?: number } = {}): FinanceContext {
  return financeContext(testScenario(), [], overrides.criticalCents ?? null);
}

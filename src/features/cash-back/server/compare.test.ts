import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fakeClient, testRuntime } from "@/lib/ai/server/testing";
import type { CashBackProfile } from "../data/source";
import { handleCompare, type CompareDeps } from "./compare";

const PROFILE: CashBackProfile = {
  customerName: "Test customer",
  asOfDate: "2026-10-17",
  ownedCardIds: [],
  spendProfile: { dining: 50_000, other: 50_000 },
  sourceLabel: "Test",
};
const body = { cardIds: ["capital-one-savor", "capital-one-quicksilver", "capital-one-venture-x"], ownedCardIds: ["capital-one-quicksilver"] };
const deps = (client: Parameters<typeof testRuntime>[0], env: Record<string, string> = {}): CompareDeps => ({ runtime: testRuntime(client, env), loadProfile: async () => PROFILE });
const post = (value: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/cash-back/compare", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(value) });

describe("card comparison route", () => {
  it("rejects bad and cross-site requests", async () => {
    expect((await handleCompare(post({ cardIds: ["capital-one-savor"], ownedCardIds: [] }), deps(null))).status).toBe(400);
    expect((await handleCompare(post(body, { origin: "https://evil.example" }), deps(null))).status).toBe(403);
  });

  it("sends the engine's numbers in dollars, without the customer's name, and returns the model's words", async () => {
    const answer = { headline: "Capital One Savor fits your spending best", overview: "It leaves $240 a year, $60 more than Quicksilver.", watchOut: null };
    const { client, jsonCalls } = fakeClient({ json: [() => answer] });
    const response = await (await handleCompare(post(body), deps(client))).json();
    expect(response).toMatchObject({ status: "ok", overview: answer, meta: { source: "model" } });
    const prompt = jsonCalls[0].user;
    expect(prompt).not.toContain("Test customer");
    const facts = JSON.parse(prompt.replace(/^FACTS:\n/, ""));
    expect(facts).toMatchObject({ yearlySpend: 12_000, bestOnYourSpending: "Capital One Savor", leadOverNext: 60 });
    expect(facts.cards[2]).toMatchObject({ name: "Capital One Venture X", annualFee: 395, netAfterFee: -155 });
  });

  it("falls back to the template when the model invents a number", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = fakeClient({ json: [() => ({ headline: "Savor wins", overview: "You'd earn $999 a year.", watchOut: null })] });
    const response = await (await handleCompare(post(body), deps(client))).json();
    expect(response.meta).toMatchObject({ source: "template", fallbackReason: "audit" });
    expect(response.overview.headline).toBe("Capital One Savor earns the most on your spending");
    warn.mockRestore();
  });

  it("answers from the template with no key, and reports a profile that can't load", async () => {
    const response = await (await handleCompare(post(body), deps(null, { GEMINI_API_KEY: "" }))).json();
    expect(response.meta).toMatchObject({ source: "template", fallbackReason: "no-key" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await handleCompare(post(body), { ...deps(null), loadProfile: async () => { throw new Error("Nessie 500 at https://secret"); } });
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret");
    error.mockRestore();
  });
});

import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { loadActiveProfile } = vi.hoisted(() => ({ loadActiveProfile: vi.fn() }));
vi.mock("@/lib/active-customer", () => ({ loadActiveProfile }));
import { GET } from "./route";

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("provides a cash account ID for read-only smoke tests only after a successful profile read", async () => {
  vi.stubEnv("NESSIE_API_KEY", "not-a-real-key");
  vi.stubEnv("NESSIE_BASE_URL", "https://prod-api.nessieisreal.com");
  loadActiveProfile.mockResolvedValue({
    sourceLabel: "Nessie sandbox", customer: { id: "customer", name: "Synthetic customer" }, asOfDate: "2026-10-18",
    scenario: { accounts: [{ id: "checking", nickname: "Checking", type: "checking", balanceCents: 100_000 }] },
    cashBack: { ownedCardIds: [] },
  });
  const response = await GET();
  const body = await response.json();
  expect(body.nessie.connected).toBe(true);
  expect(body.accounts).toEqual([{ id: "checking", nickname: "Checking", type: "checking", balanceCents: 100_000 }]);
  expect(JSON.stringify(body)).not.toContain("not-a-real-key");
  loadActiveProfile.mockRejectedValue(new Error("Nessie HTTP 503 (GET). Upstream body withheld to protect credentials."));
  const failed = await GET();
  expect(failed.status).toBe(503);
  expect(await failed.json()).toMatchObject({ nessie: { connected: false } });
});

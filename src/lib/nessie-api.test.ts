import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDeposit, deleteAccount, getCustomers, getAccountBills } from "./nessie-api";

const accountId = "152d40b2-8f39-4885-9ed1-577bb429d3ab";
function configure() {
  vi.stubEnv("NESSIE_BASE_URL", "https://prod-api.nessieisreal.com");
  vi.stubEnv("NESSIE_API_KEY", "test-key");
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Nessie server helper", () => {
  it("blocks unapproved hosts before sending credentials", async () => {
    configure(); vi.stubEnv("NESSIE_BASE_URL", "https://example.com");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(getCustomers()).rejects.toThrow("NESSIE_BASE_URL");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not expose upstream errors, URLs, or API keys", async () => {
    configure(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret test-key", { status: 401 })));
    await expect(getCustomers()).rejects.toThrow("Nessie HTTP 401 (GET). Upstream body withheld to protect credentials.");
  });
  it("handles empty delete responses", async () => {
    configure(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(deleteAccount(accountId)).resolves.toBeNull();
  });
  it("rejects invalid calendar dates and path IDs before fetching", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(() => createDeposit(accountId, 25, "demo", "2026-02-30")).toThrow("calendar date");
    expect(() => getAccountBills("../customers?key=other")).toThrow("record ID");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends the explicit date and amount without retries or redirects", async () => {
    configure(); const fetch = vi.fn().mockResolvedValue(new Response("Deposit created", { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    await expect(createDeposit(accountId, 25, "demo", "2026-10-01")).resolves.toBe("Deposit created");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url.origin).toBe("https://prod-api.nessieisreal.com");
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(options.redirect).toBe("error");
    expect(JSON.parse(options.body)).toEqual({ medium: "balance", amount: 25, description: "demo", transaction_date: "2026-10-01", status: "completed" });
  });
});

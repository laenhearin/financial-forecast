import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { runPlayground } from "./nessie-playground.mjs";

const id = "11111111-1111-4111-8111-111111111111";
const secret = "fake-test-key-never-send";
const example = fileURLToPath(new URL("./examples/nessie-bill-create.json", import.meta.url));
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("NESSIE_API_KEY", secret);
  vi.stubEnv("NESSIE_BASE_URL", "https://prod-api.nessieisreal.com");
  vi.stubEnv("NESSIE_ACCOUNT_ID", id);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Nessie playground", () => {
  it.each(["POST", "PUT", "DELETE"])("previews %s without making a request", async method => {
    const path = method === "POST" ? "/accounts/{accountId}/bills" : `/bills/${id}`;
    const result = await runPlayground([method, path, ...(method === "DELETE" ? [] : [example])]);
    expect(result).toMatchObject({ preview: true, method });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends GET with server credentials and redacts sensitive output", async () => {
    fetchMock.mockResolvedValue(Response.json({ _id: id, account_number: "1234567890123456", nickname: secret, key: secret }));
    const result = await runPlayground(["GET", "/accounts/{accountId}"]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://prod-api.nessieisreal.com/accounts/${id}?key=${secret}`);
    expect(options).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("1234567890123456");
  });

  it.each(["POST", "PUT"])("sends %s only with --send and preserves the supplied JSON body", async method => {
    fetchMock.mockResolvedValue(Response.json("Accepted", { status: method === "POST" ? 201 : 202 }));
    const path = method === "POST" ? "/accounts/{accountId}/bills" : `/bills/${id}`;
    await runPlayground([method, path, example, "--send"]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method, headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ payment_amount: 1 });
  });

  it("handles an empty successful DELETE response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await runPlayground(["DELETE", `/bills/${id}`, "--send"])).toMatchObject({ httpStatus: 204, data: null });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });

  it.each(["https://example.com/accounts/123", "/accounts/{accountId}?key=oops", `/accounts/${id}/purchases`])("rejects unsupported path %s", async path => {
    await expect(runPlayground(["GET", path])).rejects.toThrow("Unsupported");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a host change before sending credentials", async () => {
    vi.stubEnv("NESSIE_BASE_URL", "https://example.com");
    await expect(runPlayground(["GET", "/accounts/{accountId}"])).rejects.toThrow("NESSIE_BASE_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports HTTP failures without printing upstream secrets", async () => {
    fetchMock.mockResolvedValue(new Response(secret, { status: 400 }));
    await expect(runPlayground(["POST", "/accounts/{accountId}/bills", example, "--send"])).rejects.toThrow("Nessie HTTP 400");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not retry a write after a network failure", async () => {
    fetchMock.mockRejectedValue(new Error(`Failed URL ?key=${secret}`));
    await expect(runPlayground(["POST", "/accounts/{accountId}/bills", example, "--send"])).rejects.toThrow("Before retrying a write, GET");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

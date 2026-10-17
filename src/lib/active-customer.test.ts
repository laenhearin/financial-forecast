import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "cloudcash-customer" && state.cookie !== undefined ? { name, value: state.cookie } : undefined) }),
}));
const profile = vi.hoisted(() => ({ listNessieCustomers: vi.fn(), loadCustomerProfile: vi.fn() }));
vi.mock("./nessie-profile", () => profile);
import { getActiveCustomer, loadActiveProfile, resolveActiveCustomer } from "./active-customer";

const customers = [{ id: "c1", name: "First" }, { id: "c2", name: "Second" }];

beforeEach(() => {
  vi.resetAllMocks();
  state.cookie = undefined;
  profile.listNessieCustomers.mockResolvedValue(customers);
  profile.loadCustomerProfile.mockImplementation(async (customer: { id: string }, today: string) => ({ customer, asOfDate: today }));
});

describe("active customer authority", () => {
  it("uses the cookie's customer only when this key can read it", () => {
    expect(resolveActiveCustomer(customers, "c2")).toEqual(customers[1]);
    expect(resolveActiveCustomer(customers, "someone-else")).toEqual(customers[0]);
    expect(resolveActiveCustomer(customers, undefined)).toEqual(customers[0]);
    expect(() => resolveActiveCustomer([], "c1")).toThrow("no customers");
  });

  it("resolves the cookie against the live customer list", async () => {
    state.cookie = "c2";
    expect(await getActiveCustomer()).toEqual({ customers, active: customers[1] });
    state.cookie = "deleted-customer";
    expect((await getActiveCustomer()).active).toEqual(customers[0]);
  });

  it("loads the resolved customer's profile for a valid YYYY-MM-DD today", async () => {
    state.cookie = "c2";
    const loaded = await loadActiveProfile() as unknown as { customer: { id: string }; asOfDate: string };
    expect(loaded.customer.id).toBe("c2");
    expect(loaded.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(profile.loadCustomerProfile).toHaveBeenCalledWith(customers[1], loaded.asOfDate);
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { makeScenario } from "@/features/big-purchase/engine/testScenario";
import { PurchaseAdvisorApp } from "./PurchaseAdvisorApp";

vi.mock("@/components/layout/ActiveCustomer", () => ({ useActiveCustomerId: () => "test-customer" }));
vi.mock("../state/useCriticalBalance", () => ({ useCriticalBalance: () => 0 }));
vi.mock("../state/useAdvisorExplanation", () => ({ useAdvisorExplanation: () => ({ status: "idle" }) }));

afterEach(cleanup);

describe("Purchase Advisor account liquidity wording", () => {
  it("never says a negative paying account can cover a purchase when total cash is also short", () => {
    render(<PurchaseAdvisorApp scenario={makeScenario({ accounts: [
      { id: "checking", nickname: "Checking", type: "checking", balanceCents: 10_000, includeInForecast: true },
      { id: "savings", nickname: "Savings", type: "savings", balanceCents: 20_000, includeInForecast: true },
    ] })} />);
    fireEvent.change(screen.getByLabelText("What are you thinking of buying?"), { target: { value: "Laptop" } });
    fireEvent.change(screen.getByLabelText("Purchase amount ($)"), { target: { value: "1000" } });
    expect(screen.getByText(/Total cash also falls below zero/)).toBeTruthy();
    expect(screen.queryByText(/so it can cover the payment on its own/)).toBeNull();
  });
});

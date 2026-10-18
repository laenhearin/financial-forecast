// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { computeForecast } from "../engine/forecast";
import { makeScenario, paycheck } from "../engine/testScenario";
import { createGoal } from "../state/goalStore";
import { Hero } from "./Hero";

afterEach(cleanup);

it("shows the cash shortfall instead of promising an affordable date for an infeasible contribution", () => {
  const scenario = makeScenario({ balanceCents: 0, income: [paycheck(10_000, "2026-01-02")] });
  const goal = { ...createGoal("laptop", scenario.asOfDate, { name: "Laptop", costCents: 25_000 }), contributionCents: 15_000 };
  const result = computeForecast(scenario, goal);
  expect(result.ok && result.forecast.plan.affordableDate).toBe("2026-01-16");
  render(<Hero goal={goal} valid result={result} />);
  expect(screen.getByText("This plan would leave cash below $0")).toBeTruthy();
  expect(screen.queryByText(/You can afford Laptop on/)).toBeNull();
});

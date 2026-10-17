import type { Scenario } from "../features/big-purchase/types";

export interface DataSource {
  /** Shown in the UI so fixture data is always labelled. */
  readonly sourceLabel: string;
  readonly isFixture: boolean;
  getScenario(): Promise<Scenario>;   // normalized, in cents
}

export class ScenarioLoadError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = "ScenarioLoadError";
  }
}

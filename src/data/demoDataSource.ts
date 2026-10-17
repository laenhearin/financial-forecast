import type { Scenario } from "../features/big-purchase/types";
import { ScenarioLoadError, type DataSource } from "./dataSource";
import { ACTIVE_SCENARIO_ID, scenarios, type ScenarioId } from "./demo/scenarios";
import { normalizeScenario } from "./scenarioInput";
import { reportScenarioIssues, validateScenario } from "./validateScenario";

/** The only module that reads the demo file. Throws ScenarioLoadError when validation finds errors. */
export function loadDemoScenario(id: ScenarioId = ACTIVE_SCENARIO_ID): Scenario {
  const input = scenarios[id];
  if (!input) throw new ScenarioLoadError(`Unknown demo scenario "${id}".`);
  const scenario = normalizeScenario(id, input);
  const issues = validateScenario(scenario);
  reportScenarioIssues(id, issues);
  const errors = issues.filter(issue => issue.level === "error");
  if (errors.length) throw new ScenarioLoadError(`Demo scenario "${id}" is invalid.`, errors.map(issue => issue.message));
  return scenario;
}

export const demoDataSource: DataSource = {
  sourceLabel: "Demo data",
  isFixture: true,
  async getScenario() {
    return loadDemoScenario();
  },
};

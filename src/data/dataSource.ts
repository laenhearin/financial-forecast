/** A scenario that cannot be forecast; pages show the message and details on their error card. */
export class ScenarioLoadError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = "ScenarioLoadError";
  }
}

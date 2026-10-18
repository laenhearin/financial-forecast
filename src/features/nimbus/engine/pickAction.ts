import { IDLE_ACTIONS } from "../config";
import type { IdleAction } from "../types";

const ACTIONS = Object.keys(IDLE_ACTIONS) as IdleAction[];

/** Picks the next idle action by weight, never the previous one. `random` returns [0, 1). */
export function pickAction(previous: IdleAction | null, random: () => number = Math.random): IdleAction {
  const choices = ACTIONS.filter((action) => action !== previous).map((action) => ({ action, weight: IDLE_ACTIONS[action].weight }));
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let roll = random() * total;
  for (const choice of choices) {
    roll -= choice.weight;
    if (roll < 0) return choice.action;
  }
  return choices[choices.length - 1].action;
}

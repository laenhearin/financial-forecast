import { describe, expect, it } from "vitest";
import { IDLE_ACTIONS } from "../config";
import type { IdleAction } from "../types";
import { pickAction } from "./pickAction";

/** Small seeded generator (mulberry32) so the distribution checks are deterministic. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("pickAction", () => {
  it("never repeats the previous action", () => {
    const random = seeded(1);
    let previous: IdleAction | null = null;
    for (let i = 0; i < 5_000; i++) {
      const next = pickAction(previous, random);
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it("follows the weights over many picks", () => {
    const random = seeded(42);
    const runs = 40_000;
    const counts = new Map<IdleAction, number>();
    for (let i = 0; i < runs; i++) {
      const action = pickAction(null, random);
      counts.set(action, (counts.get(action) ?? 0) + 1);
    }
    const total = Object.values(IDLE_ACTIONS).reduce((sum, { weight }) => sum + weight, 0);
    for (const [action, { weight }] of Object.entries(IDLE_ACTIONS)) {
      expect((counts.get(action as IdleAction) ?? 0) / runs).toBeCloseTo(weight / total, 1);
    }
  });

  it("spreads the previous action's weight over the rest", () => {
    const random = seeded(7);
    const runs = 40_000;
    let lookArounds = 0;
    for (let i = 0; i < runs; i++) if (pickAction("wave", random) === "lookAround") lookArounds++;
    expect(lookArounds / runs).toBeCloseTo(25 / 80, 1);
  });

  it("maps the ends of the random range to the first and last choices", () => {
    expect(pickAction(null, () => 0)).toBe("wave");
    expect(pickAction("wave", () => 0)).toBe("lookAround");
    expect(pickAction(null, () => 0.999_999)).toBe("stretch");
    expect(pickAction("stretch", () => 0.999_999)).toBe("spin");
  });
});

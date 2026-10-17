import { describe, expect, it } from "vitest";
import { defaultPrefs, parsePrefs, sameSelection, toggleCard } from "./prefsStore";

describe("cash back prefs", () => {
  it("defaults to the owned cards, 90 days, and the suggestion shown", () => {
    expect(parsePrefs(null)).toEqual({ version: 1, selectedCardIds: null, windowDays: 90, showSuggestion: true });
    expect(parsePrefs("not json")).toEqual(defaultPrefs());
    expect(parsePrefs(JSON.stringify({ version: 2 }))).toEqual(defaultPrefs());
  });

  it("keeps valid fields and drops unknown or duplicate card ids", () => {
    const raw = JSON.stringify({ version: 1, selectedCardIds: ["steady-2", "nope", 7, "steady-2"], windowDays: 30, showSuggestion: false });
    expect(parsePrefs(raw)).toEqual({ version: 1, selectedCardIds: ["steady-2"], windowDays: 30, showSuggestion: false });
    expect(parsePrefs(JSON.stringify({ version: 1, windowDays: 60, showSuggestion: "yes" }))).toMatchObject({ windowDays: 90, showSuggestion: true });
  });

  it("toggles cards and compares selections ignoring order", () => {
    expect(toggleCard(["a", "b"], "b")).toEqual(["a"]);
    expect(toggleCard(["a"], "c")).toEqual(["a", "c"]);
    expect(sameSelection(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameSelection(["a"], ["a", "b"])).toBe(false);
  });
});

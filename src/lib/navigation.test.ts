import { describe, expect, it } from "vitest";
import { getActiveHref, matchesNavHref, NAV_ITEMS } from "./navigation";

describe("sidebar active state", () => {
  it("matches Home only on an exact path", () => {
    expect(matchesNavHref("/", "/")).toBe(true);
    expect(matchesNavHref("/calendar", "/")).toBe(false);
  });

  it("keeps a parent active on its sub-pages but not on look-alike paths", () => {
    expect(matchesNavHref("/big-purchase", "/big-purchase")).toBe(true);
    expect(matchesNavHref("/big-purchase/new", "/big-purchase")).toBe(true);
    expect(matchesNavHref("/big-purchases", "/big-purchase")).toBe(false);
  });

  it("returns exactly one active href for every route", () => {
    for (const item of NAV_ITEMS) {
      expect(getActiveHref(item.href)).toBe(item.href);
      expect(NAV_ITEMS.filter((other) => other.href === getActiveHref(item.href))).toHaveLength(1);
    }
    expect(getActiveHref("/cash-back/history")).toBe("/cash-back");
    expect(getActiveHref("/settings")).toBeNull();
  });

  it("prefers the most specific item when hrefs nest", () => {
    expect(getActiveHref("/a/b/c", [{ href: "/a" }, { href: "/a/b" }])).toBe("/a/b");
  });

  it("lists the six pages in order", () => {
    expect(NAV_ITEMS.map((i) => [i.label, i.href])).toEqual([
      ["Home", "/"],
      ["Calendar", "/calendar"],
      ["Purchase advisor", "/purchase-advisor"],
      ["Big purchase", "/big-purchase"],
      ["Storm solver", "/storm-solver"],
      ["Cash back", "/cash-back"],
    ]);
  });
});

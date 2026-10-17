import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps custom text sizes next to text colors", () => {
    expect(cn("h-10 text-body", "text-secondary hover:text-primary")).toBe("h-10 text-body text-secondary hover:text-primary");
    expect(cn("text-display font-semibold", "text-neg")).toBe("text-display font-semibold text-neg");
  });

  it("still lets a later size or color win", () => {
    expect(cn("text-micro", "text-caption")).toBe("text-caption");
    expect(cn("text-secondary", "text-primary")).toBe("text-primary");
    expect(cn("text-sm text-muted-foreground", "text-primary")).toBe("text-sm text-primary");
  });
});

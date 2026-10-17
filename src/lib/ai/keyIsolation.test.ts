import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the Gemini key. Only the server-only AI config may read GEMINI_API_KEY, no client module
 * may import the server AI layer, and every server AI module must import "server-only" (which
 * makes Next.js fail the build if a client component pulls one in).
 */
const SRC = join(process.cwd(), "src");
const files = (function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
})(SRC);
const rel = (path: string) => relative(SRC, path).split(sep).join("/");
const read = (path: string) => readFileSync(path, "utf8");

describe("Gemini key isolation", () => {
  it("reads GEMINI_API_KEY only in the server AI config", () => {
    expect(files.filter((path) => read(path).includes("GEMINI_API_KEY") && /process\.env|env\.GEMINI/.test(read(path))).map(rel)).toEqual(["lib/ai/server/config.ts"]);
  });

  it("never uses a NEXT_PUBLIC_ prefix for AI settings", () => {
    expect(files.filter((path) => /NEXT_PUBLIC_(GEMINI|AI_)/.test(read(path))).map(rel)).toEqual([]);
  });

  it("keeps the server AI layer out of client modules", () => {
    const clientFiles = files.filter((path) => /^\s*["']use client["']/m.test(read(path)));
    const offenders = clientFiles.filter((path) => /from\s+["'][^"']*ai\/server\//.test(read(path)) || /@google\/genai/.test(read(path)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("marks every server AI module server-only", () => {
    const serverModules = files.filter((path) => rel(path).startsWith("lib/ai/server/") && rel(path) !== "lib/ai/server/testing.ts");
    expect(serverModules.length).toBeGreaterThan(5);
    expect(serverModules.filter((path) => !read(path).startsWith('import "server-only";')).map(rel)).toEqual([]);
  });
});

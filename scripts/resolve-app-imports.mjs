// Lets Node 24 run app TypeScript modules from scripts: maps "@/..." to src/ and resolves extensionless
// relative imports to .ts/.tsx files, as the Next.js bundler does. Load with --import; no dependencies.
import { registerHooks } from "node:module";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    try {
      return nextResolve(target, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND" || !/^(\.{1,2}\/|file:)/.test(target)) throw error;
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(target + suffix, context);
        } catch {
          // Try the next candidate.
        }
      }
      throw error;
    }
  },
});

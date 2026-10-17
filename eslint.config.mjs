import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // App data comes from Nessie (src/lib/nessie-profile.ts). Fixtures are for tests; only plan-assumptions.ts reads the seed plan.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test-fixtures/**", "src/lib/plan-assumptions.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/test-fixtures/**", "@/test-fixtures/**", "**/data/nessie-demo/**"],
          message: "App code must read Nessie through src/lib/active-customer.ts, not fixtures or the seed plan.",
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

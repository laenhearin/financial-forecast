/** Read-only: Node 24, --conditions=react-server --env-file=.env.local */
// A URL import lets Node execute TypeScript directly without changing the app's bundler resolution.
const { loadNessieDemo }: typeof import("../src/lib/nessie-demo") =
  await import(new URL("../src/lib/nessie-demo.ts", import.meta.url).href);

try {
  if (process.argv.length > 3) throw new Error("Usage: scripts/read-nessie-demo.mts [college|twenties-a|twenties-b|midlife|older]");
  console.log(JSON.stringify(await loadNessieDemo(process.argv[2]), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Reading the seeded demo failed.");
  process.exitCode = 1;
}

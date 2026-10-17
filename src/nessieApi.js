// Compatibility entry point for the original helpers. Server/Node use only.
// Node 24 scripts need --conditions=react-server; Next.js enforces the server-only boundary.
// Amount arguments are raw API units. See NESSIE-DEMO-DATA.md for the seed convention.
export * from "./lib/nessie-api.ts";

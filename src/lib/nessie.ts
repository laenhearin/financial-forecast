import "server-only";

/** Configuration only: variables being set does not prove a connection. /api/dashboard reports a verified read. */
export function getNessieStatus() {
  const configured = Boolean(process.env.NESSIE_API_KEY?.trim() && process.env.NESSIE_BASE_URL?.trim());
  return { configured, message: configured ? "Credentials configured." : "Add NESSIE_API_KEY and NESSIE_BASE_URL to .env.local." };
}

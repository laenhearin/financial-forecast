import "server-only";

/** Configuration only. Verify current Nessie endpoint shapes before adding live reads. */
export function getNessieStatus() {
  const configured = Boolean(process.env.NESSIE_API_KEY && process.env.NESSIE_BASE_URL && process.env.NESSIE_ACCOUNT_ID);
  return { configured, connected: false, message: configured ? "Credentials configured. Live integration still needs verification." : "Add Nessie credentials to .env.local to begin integration." };
}

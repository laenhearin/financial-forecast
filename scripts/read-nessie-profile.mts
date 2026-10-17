/** Read-only: Node 24, --conditions=react-server --env-file=.env.local. Prints what the app reads for one customer. */
// URL imports let Node execute TypeScript directly without changing the app's bundler resolution.
const { listNessieCustomers, loadCustomerProfile }: typeof import("../src/lib/nessie-profile") =
  await import(new URL("../src/lib/nessie-profile.ts", import.meta.url).href);
const { calendarDateInTimeZone }: typeof import("../src/lib/dates") =
  await import(new URL("../src/lib/dates.ts", import.meta.url).href);

try {
  if (process.argv.length > 3) throw new Error("Usage: scripts/read-nessie-profile.mts [customerId]");
  const customers = await listNessieCustomers();
  const requested = process.argv[2];
  if (!requested) {
    console.log("Customers this key can read (pass one id to print its normalized profile):");
    for (const customer of customers) console.log(`${customer.id}  ${customer.name}`);
  } else {
    const customer = customers.find(row => row.id === requested);
    if (!customer) throw new Error("That customer id is not readable with this key. Run without arguments to list customers.");
    console.log(JSON.stringify(await loadCustomerProfile(customer, calendarDateInTimeZone(new Date())), null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Reading Nessie failed.");
  process.exitCode = 1;
}

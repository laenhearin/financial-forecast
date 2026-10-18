import type { Metadata } from "next";
import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { ScenarioLoadError } from "@/data/dataSource";
import { loadActiveProfile } from "@/lib/active-customer";
import type { CustomerProfile } from "@/lib/nessie-profile";
import { CalendarApp } from "@/features/calendar/components/CalendarApp";
import { CalendarLoadError } from "@/features/calendar/components/CalendarLoadError";
import "@/features/calendar/calendar.css";

export const metadata: Metadata = { title: "Weather Calendar" };

interface RecordedPayment {
  id: string;
  accountId: string;
  date: string;
  label: string;
  amountCents: number;
}

type LoadResult = { ok: true; profile: CustomerProfile } | { ok: false; message: string; details: string[] };

/** Loads the active Nessie customer on the server; the browser never sees the API key. */
async function loadProfile(): Promise<LoadResult> {
  try {
    return { ok: true, profile: await loadActiveProfile() };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown error.",
      details: error instanceof ScenarioLoadError ? error.details : [],
    };
  }
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const { date } = await searchParams;
  const initialDate = typeof date === "string" ? date : undefined;
  const result = await loadProfile();
  if (!result.ok) return <CalendarLoadError message={result.message} details={result.details} />;
  const { customer, scenario } = result.profile;
  const pastPayments = result.profile.history
    .filter(transaction => transaction.kind === "withdrawal" && transaction.date <= scenario.asOfDate)
    .map(({ id, accountId, date, label, amountCents }) => ({ id, accountId, date, label, amountCents }));
  return (
    <ActiveCustomerProvider customer={customer}>
      <CalendarApp key={`${scenario.id}:${scenario.asOfDate}:${initialDate ?? ""}`} initialDate={initialDate} scenario={scenario} pastPayments={pastPayments} />
    </ActiveCustomerProvider>
  );
}

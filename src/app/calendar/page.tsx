import type { Metadata } from "next";
import { ScenarioLoadError } from "@/data/dataSource";
import { loadActiveDemo } from "@/lib/active-demo";
import type { Scenario } from "@/features/big-purchase/types";
import { CalendarApp } from "@/features/calendar/components/CalendarApp";
import { CalendarLoadError } from "@/features/calendar/components/CalendarLoadError";
import "@/features/calendar/calendar.css";

export const metadata: Metadata = { title: "Weather Calendar" };

interface RecordedPayment {
  id: string;
  date: string;
  label: string;
  amountCents: number;
}

type LoadResult = { ok: true; scenario: Scenario; pastPayments: RecordedPayment[] } | { ok: false; message: string; details: string[] };

/** Loads on the server so a future live data source stays server-only. */
async function loadScenario(): Promise<LoadResult> {
  try {
    const demo = await loadActiveDemo();
    const pastPayments = demo.history
      .filter((transaction) => transaction.kind === "withdrawal")
      .map(({ id, date, label, amountCents }) => ({ id, date, label, amountCents }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    return { ok: true, scenario: demo.scenario, pastPayments };
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
  const result = await loadScenario();
  if (!result.ok) return <CalendarLoadError message={result.message} details={result.details} />;
  return <CalendarApp key={`${result.scenario.id}:${initialDate ?? ""}`} initialDate={initialDate} scenario={result.scenario} pastPayments={result.pastPayments} sourceLabel="Synthetic Nessie data + local demo assumptions" isFixture />;
}

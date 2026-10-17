import Link from "next/link";
import { ArrowRight, ArrowUpRight, CloudRain } from "lucide-react";
import { riskLevel } from "@/features/calendar/engine/model";
import { addDays, formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { ROUTES } from "@/lib/navigation";
import type { HomeData } from "./types";

export function StormPreview({ homeData }: { homeData: HomeData }) {
  const criticalDays = homeData.projection
    .filter(day => day.day > 0 && riskLevel(day.balanceCents, homeData.availableBalanceCents) >= 4)
    .sort((a, b) => a.day - b.day);

  return (
    <section aria-labelledby="storm-preview-title" className="flex min-w-0 flex-col gap-2 rounded-panel border border-app bg-card p-3">
      <div className="flex items-center justify-between">
        <h3 id="storm-preview-title" className="text-caption font-medium text-secondary">Storm solver</h3>
        <Link href={ROUTES.stormSolver} aria-label="Open Storm solver" className="rounded-item p-1 text-secondary hover:text-accent"><ArrowUpRight aria-hidden className="size-4" /></Link>
      </div>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-micro font-medium text-secondary">Upcoming critical dates</h4>
        <span className="rounded-full bg-rain-soft px-2 py-0.5 text-micro text-secondary">{criticalDays.length}</span>
      </div>
      {criticalDays.length ? (
        <ul aria-label="All upcoming critical forecast dates" className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
          {criticalDays.map(day => {
            const date = addDays(homeData.asOfDate, day.day);
            const bills = homeData.markers.filter(marker => marker.day === day.day);
            return <li key={day.day} className="flex items-center gap-2 rounded-item border border-app bg-app p-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rain-soft text-accent"><CloudRain aria-hidden className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <time dateTime={date} className="text-caption font-medium text-primary">{formatDate(date, "full")}</time>
                <p className="text-micro text-secondary">{bills.length ? bills.map(bill => bill.label).join(", ") : "Low projected balance"}</p>
              </div>
              <span className="shrink-0 text-caption font-semibold text-neg">{formatUSD(day.balanceCents)}</span>
            </li>;
          })}
        </ul>
      ) : <div className="flex flex-1 items-center justify-center rounded-item border border-dashed border-app bg-app p-3 text-center text-caption text-secondary">No critical dates in the current forecast.</div>}
      <p className="text-micro text-secondary">Based on forecast balances. Storm solver recommendations are coming soon.</p>
      <Link href={ROUTES.stormSolver} className="jump-link mt-auto self-end">Open Storm solver <ArrowRight aria-hidden className="size-4" /></Link>
    </section>
  );
}

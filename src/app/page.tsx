import { ArrowUpRight, CloudSun, Wallet, CalendarDays, Waves } from "lucide-react";
import { forecastBalance } from "@/lib/forecast";
import type { ScheduledEvent } from "@/lib/types";

const events: ScheduledEvent[] = [
  { id: "rent", name: "Rent", date: "2026-10-18", amountCents: 65000, type: "expense" },
  { id: "utilities", name: "Utilities", date: "2026-10-19", amountCents: 12000, type: "expense" },
  { id: "subscription", name: "Subscription", date: "2026-10-20", amountCents: 2000, type: "expense" },
  { id: "paycheck", name: "Paycheck", date: "2026-10-23", amountCents: 50000, type: "income" },
];
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

export default function Home() {
  const days = forecastBalance(90000, "2026-10-17", 7, events);
  const lowest = Math.min(...days.map(day => day.closingBalanceCents));
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#203b34]">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-[#203b34]/10 px-6 py-7">
        <div className="flex items-center gap-3 font-semibold tracking-tight"><Waves size={27} /> financial forecast<span className="hidden text-sm font-normal text-[#718078] sm:inline"> / your money, ahead</span></div>
        <span className="rounded-full border border-[#203b34]/15 px-3 py-1 text-xs">Demo workspace</span>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#64766a]"><CloudSun size={17} /> A little more clarity</div>
        <h1 className="max-w-3xl text-4xl font-medium leading-tight tracking-tight md:text-6xl">See the tight days.<br />Plan for brighter ones.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#64766a]">Your balance is only part of the story. Explore how upcoming bills and payday shape the week ahead.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Opening balance", value: "$900", note: "October 17 · sample checking", icon: Wallet },
            { label: "Lowest projected balance", value: money(lowest), note: "October 20 · after scheduled bills", icon: CloudSun },
            { label: "Next payday", value: "+$500", note: "October 23 · sample income", icon: CalendarDays },
          ].map(({ label, value, note, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#203b34]/10 bg-white p-6"><div className="flex items-center justify-between text-sm text-[#64766a]">{label}<Icon size={18} /></div><p className="mt-5 text-3xl font-medium tracking-tight">{value}</p><p className="mt-2 text-xs text-[#64766a]">{note}</p></div>)}
        </div>
        <div className="mt-8 rounded-2xl border border-[#203b34]/10 bg-white p-5 md:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">Your week at a glance</h2><span className="text-xs text-[#64766a]">October 17–23, 2026 · fixed sample dates</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {days.map(day => <div key={day.date} className={`min-h-40 rounded-xl p-4 ${day.closingBalanceCents < 20000 ? "bg-[#fff4dc]" : "bg-[#edf3ec]"}`}>
              <p className="text-xs text-[#64766a]">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" })}</p>
              <p className="mt-4 text-xl font-semibold">{money(day.closingBalanceCents)}</p>
              <p className="mt-1 text-[11px] text-[#64766a]">{day.closingBalanceCents < 20000 ? "Below $200 buffer" : "Above buffer"}</p>
              <div className="mt-5 space-y-1 text-xs">{day.events.length ? day.events.map(event => <p key={event.id}>{event.name}</p>) : <p className="text-[#64766a]">No scheduled bills</p>}</div>
            </div>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-[#64766a]">Illustrative closing balances based only on the sample bills and income shown. Everyday spending is not included. These are fixtures, not live Nessie data.</p>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#203b34] p-6 text-[#f7f8f3]">
          <div><h2 className="font-medium">Your team’s starting point</h2><p className="mt-1 text-sm text-[#c5d5cb]">Next up: connect Nessie, then build the purchase simulator.</p></div>
          <a href="/api/dashboard" className="flex items-center gap-2 rounded-full bg-[#d6edaf] px-5 py-3 text-sm font-medium text-[#203b34]">Check integration status<ArrowUpRight size={16} /></a>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-6 pb-8 text-xs text-[#64766a]">Built for SwampHacks XII · Mock banking only</footer>
    </main>
  );
}

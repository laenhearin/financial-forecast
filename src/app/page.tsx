import { buildHomeForecast } from "@/lib/home-forecast";
import { DebtSummary } from "@/components/home/DebtSummary";
import { monthlyActivity } from "@/lib/monthly-activity";
import { historicalBalances } from "@/lib/historical-balances";
import { AskBox } from "@/components/home/AskBox";
import { BalanceChart } from "@/components/home/BalanceChart";
import { FeaturePreviews } from "@/components/home/FeaturePreviews";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SuggestionChips } from "@/components/home/SuggestionChips";
import { ActiveCustomerProvider } from "@/components/layout/ActiveCustomer";
import { defaultCriticalBalanceCents, majorBillWithinWeek } from "@/features/calendar/engine/balanceThresholds";
import { scenarioEntries } from "@/features/calendar/engine/entries";
import { loadActiveProfile } from "@/lib/active-customer";
import { forecastEstimateNote, nessieSourceNote } from "@/lib/data-source";
import { formatDate, daysBetween } from "@/lib/dates";

async function loadHome() {
  const profile = await loadActiveProfile();
  const { scenario, history, asOfDate } = profile;
  const today = monthlyActivity(history.filter(record => record.date === asOfDate), asOfDate);
  const homeData = buildHomeForecast(scenario);
  const accounts = new Set(scenario.accounts.filter(account => account.includeInForecast).map(account => account.id));
  return {
    ...profile,
    homeData,
    historicalDays: historicalBalances(history.filter(record => accounts.has(record.accountId)), asOfDate, homeData.availableBalanceCents),
    defaultCriticalCents: defaultCriticalBalanceCents(scenario),
    billEntries: scenarioEntries(scenario),
    monthlyTotals: monthlyActivity(history, asOfDate),
    todayNetCents: today.incomeCents - today.spendingCents,
  };
}

export default async function HomePage() {
  let home: Awaited<ReturnType<typeof loadHome>>;
  try {
    home = await loadHome();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Nessie customer could not be loaded.";
    return <div role="alert" className="mx-auto max-w-180 px-5 py-16 text-body text-neg">Financial Forecast could not load Nessie data: {message}</div>;
  }

  const { scenario, asOfDate, cashBack, customer, homeData, defaultCriticalCents, billEntries, monthlyTotals, todayNetCents } = home;
  const projectedLow = homeData.projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
  const upcomingMajorBill = majorBillWithinWeek(billEntries, homeData.asOfDate);
  const majorBillBalance = upcomingMajorBill ? homeData.projection[daysBetween(homeData.asOfDate, upcomingMajorBill.date)]?.balanceCents ?? null : null;
  const majorBillLabel = upcomingMajorBill ? `${upcomingMajorBill.label} due ${formatDate(upcomingMajorBill.date, "short")}` : null;

  return (
    <ActiveCustomerProvider customer={customer}>
      <div className="mx-auto grid w-full max-w-400 gap-x-6 gap-y-4 px-4 py-4 md:px-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(17rem,1fr)]">
        <HomeHeader className="lg:col-start-1" scenario={scenario} projection={homeData.projection} balanceCents={projectedLow.balanceCents} defaultCriticalBalanceCents={defaultCriticalCents} majorBillBalanceCents={majorBillBalance} majorBillDate={upcomingMajorBill?.date} majorBillLabel={majorBillLabel} nextStormLabel={homeData.nextStormLabel} userName={homeData.userName} />
        <div className="flex min-w-0 flex-col lg:col-start-1 lg:row-start-2">
          <DebtSummary scenario={scenario} />
          <BalanceChart
            key={scenario.id}
            history={home.historicalDays}
            asOfDate={homeData.asOfDate}
            scenario={scenario}
            todayNetCents={todayNetCents}
            className="home-forecast shrink-0 rounded-3xl border border-app p-4 md:p-5"
            availableBalanceCents={homeData.availableBalanceCents}
            projection={homeData.projection}
            markers={homeData.markers}
            monthlyTotals={monthlyTotals}
          />
          <section aria-label="Ask about your money" className="mt-3 flex flex-1 flex-col rounded-3xl border border-app bg-card p-3">
            <AskBox className="flex flex-1 flex-col" defaultCriticalBalanceCents={defaultCriticalCents} />
            <SuggestionChips className="mt-3" />
          </section>
        </div>
        <aside className="min-w-0 lg:col-start-2 lg:row-start-2">
          <FeaturePreviews homeData={homeData} cashBack={cashBack} scenario={scenario} />
        </aside>
        <p className="text-micro text-secondary lg:col-span-2">{nessieSourceNote(customer.name, asOfDate)} {forecastEstimateNote(scenario)}</p>
      </div>
    </ActiveCustomerProvider>
  );
}

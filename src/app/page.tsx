import { buildHomeForecast } from "@/lib/home-forecast";
import { monthlyActivity } from "@/lib/monthly-activity";
import { AskBox } from "@/components/home/AskBox";
import { BalanceChart } from "@/components/home/BalanceChart";
import { FeaturePreviews } from "@/components/home/FeaturePreviews";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SuggestionChips } from "@/components/home/SuggestionChips";
import { riskLevel } from "@/features/calendar/engine/model";
import type { HomeData } from "@/components/home/types";
import { loadActiveDemo } from "@/lib/active-demo";
import type { CashBackData } from "@/features/cash-back/data/source";
import type { Goal, Scenario } from "@/features/big-purchase/types";

export default async function HomePage() {
  let homeData: HomeData;
  let cashBackData: CashBackData;
  let demoGoal: Goal;
  let scenario: Scenario;
  let monthlyTotals: ReturnType<typeof monthlyActivity>;
  try {
    const demo = await loadActiveDemo();
    homeData = buildHomeForecast(demo.scenario);
    cashBackData = demo.cashBack;
    demoGoal = demo.goal;
    scenario = demo.scenario;
    monthlyTotals = monthlyActivity(demo.history, demo.asOfDate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The selected demo profile could not be loaded.";
    return <div className="mx-auto max-w-180 px-5 py-16 text-body text-neg">CloudCash could not load this demo profile: {message}</div>;
  }

  const projectedLow = homeData.projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
  const risk = riskLevel(projectedLow.balanceCents, homeData.availableBalanceCents);
  const weather = risk >= 4 ? "downpour" : risk >= 2 ? "rainy" : risk === 1 ? "cloudy" : "sunny";

  return (
    <div data-weather={weather} className="home-weather min-h-screen">
      <div className="mx-auto grid w-full max-w-400 gap-x-6 gap-y-4 px-4 py-4 md:px-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(17rem,1fr)]">
        <HomeHeader className="lg:col-start-1" weather={weather} nextStormLabel={homeData.nextStormLabel} userName={homeData.userName} />
        <div className="flex min-w-0 flex-col lg:col-start-1 lg:row-start-2">
          <BalanceChart
            asOfDate={homeData.asOfDate}
            className="home-forecast flex-1 rounded-3xl border border-app p-4 md:p-5"
            availableBalanceCents={homeData.availableBalanceCents}
            projection={homeData.projection}
            markers={homeData.markers}
            monthlyTotals={monthlyTotals}
          />
          <section aria-label="Ask about your money" className="mt-3 rounded-3xl border border-app bg-card p-3">
            <AskBox />
            <SuggestionChips className="mt-3" />
          </section>
        </div>
        <aside className="min-w-0 lg:col-start-2 lg:row-start-2">
          <FeaturePreviews homeData={homeData} cashBackData={cashBackData} demoGoal={demoGoal} scenario={scenario} />
        </aside>
        <p className="text-micro text-secondary lg:col-span-2">Synthetic Nessie demo data and forecast assumptions.</p>
      </div>
    </div>
  );
}

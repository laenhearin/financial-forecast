import { AskBox } from "@/components/home/AskBox";
import { BalanceChart } from "@/components/home/BalanceChart";
import { FeaturePreviews } from "@/components/home/FeaturePreviews";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SuggestionChips } from "@/components/home/SuggestionChips";
import { projectBase } from "@/features/big-purchase/engine/base";
import { riskLevel } from "@/features/calendar/engine/model";
import { scenarioEntries } from "@/features/calendar/engine/entries";
import type { HomeData } from "@/components/home/types";
import { loadActiveDemo } from "@/lib/active-demo";
import { homeData as sampleHomeData } from "@/lib/mock/homeData";
import { daysBetween } from "@/lib/dates";
import type { CashBackData } from "@/features/cash-back/data/source";
import type { Goal } from "@/features/big-purchase/types";

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export default async function HomePage() {
  let homeData: HomeData;
  let cashBackData: CashBackData;
  let demoGoal: Goal;
  try {
    const demo = await loadActiveDemo();
    const base = projectBase(demo.scenario);
    const projection = base.days.slice(0, 31).map((point, day) => ({ day, balanceCents: point.baseCents }));
    const low = projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
    const entries = scenarioEntries(demo.scenario);
    const markers = entries
      .filter((entry) => entry.kind === "bill")
      .map((entry) => ({ day: daysBetween(demo.scenario.asOfDate, entry.date), label: entry.label }))
      .filter((marker) => marker.day > 0 && marker.day <= 30)
      .slice(0, 3);
    homeData = {
      ...sampleHomeData,
      isSampleData: true,
      userName: demo.scenario.customerName,
      nextStormLabel: low.day > 0 ? weekday(base.days[low.day].date) : null,
      availableBalanceCents: base.startingCashCents,
      projection,
      markers,
    };
    cashBackData = demo.cashBack;
    demoGoal = demo.goal;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The selected demo profile could not be loaded.";
    return <div className="mx-auto max-w-180 px-5 py-16 text-body text-neg">CloudCash could not load this demo profile: {message}</div>;
  }

  const projectedLow = homeData.projection.reduce((lowest, point) => point.balanceCents < lowest.balanceCents ? point : lowest);
  const risk = riskLevel(projectedLow.balanceCents, homeData.availableBalanceCents);
  const weather = risk >= 4 ? "downpour" : risk >= 2 ? "rainy" : risk === 1 ? "cloudy" : "sunny";

  return (
    <div data-weather={weather} className="home-weather min-h-screen">
      <div className="mx-auto grid w-full max-w-350 gap-10 px-5 pt-10 pb-10 md:px-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,0.9fr)] lg:gap-12 lg:pt-14">
        <main className="min-w-0">
          <HomeHeader weather={weather} nextStormLabel={homeData.nextStormLabel} />
          <AskBox className="mt-7" />
          <SuggestionChips className="mt-6" />
          <BalanceChart
            className="mt-16 rounded-panel border border-app bg-card p-5 md:p-7"
            availableBalanceCents={homeData.availableBalanceCents}
            projection={homeData.projection}
            markers={homeData.markers}
            isSampleData={homeData.isSampleData}
          />
          <FeaturePreviews placement="below" homeData={homeData} cashBackData={cashBackData} demoGoal={demoGoal} />
        </main>
        <aside className="min-w-0 lg:pt-24">
          <FeaturePreviews placement="side" homeData={homeData} cashBackData={cashBackData} demoGoal={demoGoal} />
        </aside>
      </div>
    </div>
  );
}

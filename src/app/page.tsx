import { AskBox } from "@/components/home/AskBox";
import { BalanceChart } from "@/components/home/BalanceChart";
import { FeaturePreviews } from "@/components/home/FeaturePreviews";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SuggestionChips } from "@/components/home/SuggestionChips";
import { homeData } from "@/lib/mock/homeData";
import { riskLevel } from "@/features/calendar/engine/model";

/** Home: header, ask box, chips, balance graph, cards. Data comes from one module so the forecast engine can replace it. */
export default function HomePage() {
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
          <FeaturePreviews placement="below" />
        </main>
        <aside className="min-w-0 lg:pt-24">
          <FeaturePreviews placement="side" />
        </aside>
      </div>
    </div>
  );
}

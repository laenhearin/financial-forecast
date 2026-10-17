import { AskBox } from "@/components/home/AskBox";
import { BalanceChart } from "@/components/home/BalanceChart";
import { FeaturePreviews } from "@/components/home/FeaturePreviews";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SuggestionChips } from "@/components/home/SuggestionChips";
import { homeData } from "@/lib/mock/homeData";
import { riskLevel } from "@/features/calendar/engine/model";

/** Forecast-first home dashboard, backed by the existing sample data. */
export default function HomePage() {
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
            isSampleData={homeData.isSampleData}
          />
          <section aria-label="Ask about your money" className="mt-3 rounded-3xl border border-app bg-card p-3">
            <AskBox />
            <SuggestionChips className="mt-3" />
          </section>
        </div>
        <aside className="min-w-0 lg:col-start-2 lg:row-start-2">
          <FeaturePreviews />
        </aside>
      </div>
    </div>
  );
}

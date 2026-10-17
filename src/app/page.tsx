import { AskBox } from "@/components/home/AskBox";
import { AttentionCards } from "@/components/home/AttentionCards";
import { BalanceChart } from "@/components/home/BalanceChart";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SuggestionChips } from "@/components/home/SuggestionChips";
import { homeData } from "@/lib/mock/homeData";

/** Home: header, ask box, chips, balance graph, cards. Data comes from one module so the forecast engine can replace it. */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-180 px-5 pt-14 pb-10 md:px-10">
      <HomeHeader todayWeather={homeData.todayWeather} nextStormLabel={homeData.nextStormLabel} />
      <AskBox className="mt-7" />
      <SuggestionChips className="mt-6" />
      <BalanceChart
        className="mt-14"
        availableBalanceCents={homeData.availableBalanceCents}
        projection={homeData.projection}
        markers={homeData.markers}
        isSampleData={homeData.isSampleData}
      />
      <AttentionCards className="mt-12" cards={homeData.cards} />
    </div>
  );
}

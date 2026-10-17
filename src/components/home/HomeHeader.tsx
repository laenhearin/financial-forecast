import { Cloud, CloudLightning, CloudRain, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Weather } from "./types";

const CONDITIONS: Record<Weather, { icon: LucideIcon; label: string }> = {
  sunny: { icon: Sun, label: "Great balance outlook" },
  cloudy: { icon: Cloud, label: "Steady balance outlook" },
  rainy: { icon: CloudRain, label: "Low balance outlook" },
  downpour: { icon: CloudLightning, label: "Critical balance outlook" },
};

interface HomeHeaderProps {
  userName: string;
  weather: Weather;
  /** Day of the next tight spot, such as "Thursday"; null hides the second half of the status line. */
  nextStormLabel: string | null;
  className?: string;
}

export function HomeHeader({ weather, nextStormLabel, userName, className }: HomeHeaderProps) {
  const { icon: TodayIcon, label } = CONDITIONS[weather];
  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-3xl font-medium tracking-tight text-balance text-primary md:text-3xl 2xl:text-4xl">Welcome back, {userName}</h1>
      <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-body text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <TodayIcon aria-hidden className={cn("size-4", weather === "sunny" ? "text-sun" : weather === "downpour" ? "text-neg" : "text-rain")} strokeWidth={1.75} />
          {label}
        </span>
        {nextStormLabel && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <CloudRain aria-hidden className="size-4 text-rain" strokeWidth={1.75} />
              Rain on {nextStormLabel}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

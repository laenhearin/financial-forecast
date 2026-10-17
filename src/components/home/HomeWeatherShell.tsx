import type { ReactNode } from "react";
import styles from "./HomeWeatherShell.module.css";
import { dailyWeather } from "./weeklyForecast";

/** The sky reflects today's cash flow, independently of forecast interactions. */
export function HomeWeatherShell({ children, todayNetCents, hasBillToday }: { children: ReactNode; todayNetCents: number; hasBillToday: boolean }) {
  return <div data-weather={dailyWeather(todayNetCents, hasBillToday)} className={`${styles.sky} min-h-screen`}>
    <div aria-hidden="true" className={styles.rain} />
    {children}
  </div>;
}

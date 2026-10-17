import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { WeatherStageSync } from "@/components/layout/WeatherStageSync";
import { cn } from "@/lib/utils";
import { loadActiveDemo } from "@/lib/active-demo";
import styles from "@/components/layout/WeatherTheme.module.css";
import { defaultCriticalBalanceCents } from "@/features/calendar/engine/balanceThresholds";
import { weatherStage, type WeatherStage } from "@/features/calendar/engine/weatherStage";
import type { Scenario } from "@/features/big-purchase/types";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: { default: "CloudCash", template: "%s · CloudCash" },
  description: "Your money, a little clearer.",
  icons: { icon: "/icon.png", shortcut: "/icon.png", apple: "/icon.png" },
};

/** The shared shell: every page renders inside <main>, next to the one Sidebar. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let scenario: Scenario | null = null;
  let criticalBalanceCents = 0;
  let weather: WeatherStage | "unavailable" = "unavailable";
  try {
    const demo = await loadActiveDemo();
    scenario = demo.scenario;
    criticalBalanceCents = defaultCriticalBalanceCents(demo.scenario);
    weather = weatherStage(demo.scenario, [], criticalBalanceCents);
  } catch {
    // Pages display their data errors; the shared shell remains usable without a weather claim.
  }
  return (
    // next-themes sets data-theme on <html> before hydration.
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body data-weather={weather} className={cn(styles.sky, "flex min-h-screen flex-col text-primary antialiased md:flex-row")}>
        <div aria-hidden="true" className={styles.rain} />
        <ThemeProvider>
          <WeatherStageSync scenario={scenario} defaultCriticalBalanceCents={criticalBalanceCents} />
          <Sidebar />
          <AccountMenu />
          <main className="min-h-screen min-w-0 flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

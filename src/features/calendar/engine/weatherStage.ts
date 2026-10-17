import { addDays } from "@/lib/dates";
import type { Scenario } from "@/features/big-purchase/types";
import { balanceOn, buildCalendarModel } from "./model";
import { balanceLevel, majorBillImpact } from "./balanceThresholds";
import { ALL_ACCOUNTS, type UserPurchase } from "../types";

export type WeatherStage = "sunny" | "cloudy" | "rainy" | "downpour";

/** Match the home outlook: lowest 30-day balance plus any major bill that creates a warning. */
export function weatherStage(scenario: Scenario, purchases: readonly UserPurchase[], criticalCents: number): WeatherStage {
  const model = buildCalendarModel(scenario, purchases, ALL_ACCOUNTS);
  const throughDate = addDays(model.asOfDate, 30);
  let lowest = model.startingCents;

  for (const [date] of model.balances) {
    if (date > throughDate) break;
    lowest = Math.min(lowest, balanceOn(model, date) ?? lowest);
  }

  const balanceSeverity = balanceLevel(lowest, criticalCents);
  const billWarning = majorBillImpact(model.entries, model.asOfDate, criticalCents, (date) => balanceOn(model, date));
  const severity = Math.max(balanceSeverity, billWarning?.level ?? 0);

  if (severity >= 4) return "downpour";
  if (severity >= 2) return "rainy";
  if (severity === 1) return "cloudy";
  return "sunny";
}

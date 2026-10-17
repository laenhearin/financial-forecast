import "server-only";
import plan from "../../data/nessie-demo/plan.json" with { type: "json" };
import type { Schedule } from "../features/big-purchase/types";
import { isCategoryId, type SpendProfile } from "../features/cash-back/types";
import { isISODate } from "./dates";
import { isCents } from "./money";
import type { NessieRecord } from "./nessie-api";

/**
 * Local planning assumptions for the seeded customers. Nessie stores balances, bills, history, and
 * loans, but no income schedule or spending budget, so those come from data/nessie-demo/plan.json and
 * are labeled as plan assumptions. A customer is matched by the seed's checking-account nickname
 * ("ff-demo-v1/<slug>/checking"), so renaming the customer in Nessie keeps the match.
 */
export interface PlanAssumptions {
  slug: string;
  income: { label: string; amountCents: number; schedule: Schedule };
  monthlySpendingCents: number;
  /** Monthly spend per cash-back category. */
  spendProfile: SpendProfile;
}

export function planAssumptionsFor(accounts: readonly NessieRecord[]): PlanAssumptions | null {
  const prefix = `${plan.seedId}/`;
  const slugs = accounts
    .map(account => (typeof account.nickname === "string" ? account.nickname : ""))
    .filter(nickname => isSeedChecking(nickname, prefix))
    .map(nickname => nickname.slice(prefix.length, -"/checking".length));
  const profile = plan.profiles.find(row => slugs.includes(row.slug));
  return profile ? toAssumptions(profile) : null;
}

function isSeedChecking(nickname: string, prefix: string): boolean {
  return nickname.startsWith(prefix) && nickname.endsWith("/checking");
}

type PlanProfile = (typeof plan.profiles)[number];

function toAssumptions(profile: PlanProfile): PlanAssumptions {
  const { income } = profile;
  const problem = (field: string) => new Error(`data/nessie-demo/plan.json: ${profile.slug} has an invalid ${field}.`);
  if (!isCents(income.amountCents) || income.amountCents <= 0) throw problem("income amount");
  if (!isISODate(income.anchorDate)) throw problem("income anchorDate");
  if (income.frequency !== "monthly" && income.frequency !== "biweekly") throw problem("income frequency");
  if (!isCents(profile.estimatedMonthlySpendingCents) || profile.estimatedMonthlySpendingCents < 0) throw problem("monthly spending");
  const spendProfile: SpendProfile = {};
  for (const [category, cents] of Object.entries(profile.monthlySpendingByCategory ?? {})) {
    if (!isCategoryId(category) || !isCents(cents) || cents < 0) throw problem("monthlySpendingByCategory");
    spendProfile[category] = cents;
  }
  return {
    slug: profile.slug,
    income: {
      label: income.label,
      amountCents: income.amountCents,
      schedule: income.frequency === "monthly"
        ? { frequency: "monthly", dayOfMonth: Number(income.anchorDate.slice(8, 10)) }
        : { frequency: "biweekly", anchorDate: income.anchorDate },
    },
    monthlySpendingCents: profile.estimatedMonthlySpendingCents,
    spendProfile,
  };
}

import "server-only";
import plan from "../../data/nessie-demo/plan.json" with { type: "json" };
import type { Schedule } from "../features/big-purchase/types";
import { isISODate } from "./dates";
import { isCents } from "./money";
import type { NessieRecord } from "./nessie-api";

/**
 * Local planning assumptions for the seeded customers. Nessie stores balances, bills, history, and
 * loans, but no income schedule, so the paycheck comes from data/nessie-demo/plan.json and is labeled
 * as a plan assumption. Spending comes from the Nessie history. A customer is matched by the seed's
 * checking-account nickname ("ff-demo-v1/<slug>/checking"), so renaming the customer in Nessie keeps
 * the match.
 */
export interface PlanAssumptions {
  slug: string;
  income: { label: string; amountCents: number; schedule: Schedule };
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
  return {
    slug: profile.slug,
    income: {
      label: income.label,
      amountCents: income.amountCents,
      schedule: income.frequency === "monthly"
        ? { frequency: "monthly", dayOfMonth: Number(income.anchorDate.slice(8, 10)) }
        : { frequency: "biweekly", anchorDate: income.anchorDate },
    },
  };
}

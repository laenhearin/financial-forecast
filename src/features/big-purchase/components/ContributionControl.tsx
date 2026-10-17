"use client";

import { Minus, OctagonAlert, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { CONTRIBUTION_STEP_CENTS } from "../config";
import type { BigPurchaseModel } from "../hooks/useBigPurchase";
import type { Forecast, Goal } from "../types";
import { MoneyInput } from "./MoneyInput";
import { Bounce } from "./motion";
import { mutedTextClass } from "./ui";

/** Contribution per paycheck: blank means the suggested amount. */
export function ContributionControl({ goal, model }: { goal: Goal; model: BigPurchaseModel }) {
  const { forecast } = model;
  const { update } = model.actions;
  const suggested = forecast?.suggestedContributionCents ?? null;
  const affordableNow = forecast?.plan.affordableNow ?? false;
  const step = (direction: 1 | -1) => {
    const base = goal.contributionCents ?? suggested ?? 0;
    update({ field: "contribution", value: Math.max(0, base + direction * CONTRIBUTION_STEP_CENTS) });
  };
  const stepperClass = "size-(--bp-control-height) shrink-0 rounded-(--bp-radius-control) border-(--bp-line) bg-(--bp-surface) hover:bg-(--bp-bg)";

  return (
    <div className="space-y-2">
      <Label htmlFor="bp-contribution" className="font-semibold">Contribution per paycheck</Label>
      <div className="flex items-start gap-2">
        <Bounce disabled={affordableNow}>
          <Button type="button" variant="outline" className={stepperClass} aria-label="Decrease by $5" disabled={affordableNow} onClick={() => step(-1)}><Minus aria-hidden /></Button>
        </Bounce>
        <MoneyInput
          id="bp-contribution"
          className="flex-1"
          value={goal.contributionCents}
          placeholder={suggested !== null ? `${suggested / 100} (suggested)` : "Suggested"}
          disabled={affordableNow}
          describedBy="bp-contribution-help"
          onChange={cents => update({ field: "contribution", value: cents })}
        />
        <Bounce disabled={affordableNow}>
          <Button type="button" variant="outline" className={stepperClass} aria-label="Increase by $5" disabled={affordableNow} onClick={() => step(1)}><Plus aria-hidden /></Button>
        </Bounce>
      </div>
      <div id="bp-contribution-help" className={`flex flex-wrap items-center gap-2 text-sm ${mutedTextClass}`}>
        {affordableNow
          ? "No contributions needed. You can buy this now."
          : forecast
            ? <span>Suggested up to {formatUSD(forecast.suggestedContributionCents)}, limit {formatUSD(forecast.limitContributionCents)}</span>
            : <span>Enter a cost to see the suggested amount.</span>}
        {goal.contributionCents !== null && forecast && !affordableNow && (
          <Bounce>
            <button type="button" onClick={() => update({ field: "contribution", value: null })}
              className="min-h-8 rounded-full bg-(--bp-mint) px-3 text-xs font-semibold text-(--bp-ink)">
              Use suggested
            </button>
          </Bounce>
        )}
      </div>
      {forecast && !model.pending && <ContributionBanner forecast={forecast} bufferCents={goal.bufferCents} />}
    </div>
  );
}

/** Yellow notice under the buffer, red alert below $0. Icon plus text label, never color alone. */
export function ContributionBanner({ forecast, bufferCents }: { forecast: Forecast; bufferCents: number }) {
  const { plan } = forecast;
  if (plan.tier === "ok") return null;
  if (plan.tier === "notice") {
    return (
      <div role="status" className="flex gap-3 rounded-(--bp-radius-control) bg-(--bp-butter) p-3 text-sm text-(--bp-warn-ink)">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong>Notice:</strong> above the suggested amount of {formatUSD(forecast.suggestedContributionCents)}.
          Cash would fall to {formatUSD(plan.lowestSpendableCents)} on {formatDate(plan.lowestSpendableDate, "long")}, under your buffer of {formatUSD(bufferCents)}.
        </p>
      </div>
    );
  }
  const first = plan.violations.find(violation => violation.kind === "negative")!;
  return (
    <div role="status" className="flex gap-3 rounded-(--bp-radius-control) bg-(--bp-rose) p-3 text-sm text-(--bp-danger-ink)">
      <OctagonAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p>
        <strong>Alert:</strong> cash would go negative on {formatDate(first.date, "full")}, short by {formatUSD(first.shortfallCents)}.
        Keep it at {formatUSD(forecast.limitContributionCents)} or less.
      </p>
    </div>
  );
}

"use client";

import { ArrowLeft, CalendarClock, Database, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DebtSummary } from "@/components/home/DebtSummary";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import { forecastEstimateNote, nessieSourceNote } from "@/lib/data-source";
import { useBigPurchase } from "../hooks/useBigPurchase";
import type { Scenario } from "../types";
import { canReset } from "../state/goalStore";
import { AdvicePanel } from "./AdvicePanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeadlineSlider } from "./DeadlineSlider";
import { FundingChart } from "./FundingChart";
import { GoalCard } from "./GoalCard";
import { Hero } from "./Hero";
import { FadeRise } from "./motion";
import { PercentChart } from "./PercentChart";
import { ResetButton } from "./ResetButton";
import { cardClass, mutedTextClass, previewClass } from "./ui";
import { WelcomeFlow } from "./WelcomeFlow";

export type BigPurchaseLoad = { ok: true; scenario: Scenario } | { ok: false; message: string; details: string[] };

/** The page loads the active Nessie customer on the server and passes either their scenario or the load error. */
export function BigPurchaseApp({ load }: { load: BigPurchaseLoad }) {
  if (!load.ok) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 pb-16">
        <header className="py-6 text-center"><h1 className="page-title">Forecast Fund</h1></header>
        <ErrorCard title="We couldn't load your data" message={load.message} details={load.details} />
      </div>
    );
  }
  return <Planner key={load.scenario.id} scenario={load.scenario} />;
}

function Planner({ scenario }: { scenario: Scenario }) {
  const model = useBigPurchase(scenario);
  const { goal, forecast, valid, actions } = model;
  const [confirm, setConfirm] = useState<"deactivate" | "reset" | null>(null);
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalView, setGoalView] = useState<"draft" | "active">("draft");
  const initializedView = useRef(false);

  useEffect(() => {
    if (model.hydrated && !initializedView.current) {
      initializedView.current = true;
      setGoalView(goal?.status ?? "draft");
    }
  }, [model.hydrated, goal?.status]);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-16">
      <header className="flex flex-col items-center gap-4 py-6 text-center">
        <div>
          <h1 className="page-title">Forecast Fund</h1>
          <p className={`mt-1 flex items-start justify-center gap-1.5 text-sm ${mutedTextClass}`}>
            <Database aria-hidden className="mt-0.5 size-4 shrink-0" />
            {nessieSourceNote(scenario.customerName, scenario.asOfDate)} {forecastEstimateNote(scenario)}
          </p>
        </div>
        {goal && (
          <div className="flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="Goal status view" className="flex rounded-(--bp-radius-control) border border-(--bp-line) bg-(--bp-bg) p-1">
              {(["draft", "active"] as const).map(status => (
                <button key={status} type="button" role="tab" aria-selected={goalView === status} onClick={() => {
                  setGoalView(status);
                  const matchingGoal = model.goals.find(item => item.status === status);
                  if (matchingGoal) actions.selectGoal(matchingGoal.id);
                }} className={`min-h-9 rounded-[calc(var(--bp-radius-control)-4px)] px-4 text-sm font-semibold ${goalView === status ? status === "active" ? "bg-(--bp-mint) text-(--bp-ink) shadow-(--bp-shadow-pill)" : "bg-(--bp-surface) text-(--bp-ink) shadow-(--bp-shadow-pill)" : "text-(--bp-muted) hover:text-(--bp-ink)"}`}>
                  {status === "draft" ? "Drafts" : "Active"}
                </button>
              ))}
            </div>
            {goalView === "draft" && goal.status === "draft" ? (
              <Button type="button" disabled={!valid} onClick={() => {
                const error = actions.setStatus("active");
                if (!error) setGoalView("active");
              }}>Commit to active</Button>
            ) : goalView === "active" && goal.status === "active" ? (
              <Button type="button" variant="outline" onClick={() => setConfirm("deactivate")}>Move to drafts</Button>
            ) : null}
            <ResetButton enabled={canReset(goal)} onClick={() => setConfirm("reset")} />
          </div>
        )}
      </header>

      <DebtSummary scenario={scenario} />

      {model.goals.length > 0 && !addingGoal && (
        <div className="mb-6 grid gap-4">
          {goalView === "draft" ? (
            <GoalGroup title="Draft goals" description="Items you may want to buy. Draft forecasts are previews; no money is set aside." goals={model.goals.filter(item => item.status === "draft")} selectedId={goal?.id} onSelect={actions.selectGoal} />
          ) : (
            <GoalGroup title="Active goal" description="Money is reserved from each paycheck according to this goal’s forecast." goals={model.goals.filter(item => item.status === "active")} selectedId={goal?.id} onSelect={actions.selectGoal} activeContribution={model.activeForecast?.plan.contributionCents} activeAlreadyAffordable={model.activeForecast?.plan.affordableNow} />
          )}
          <button type="button" onClick={() => setAddingGoal(true)} className="rounded-(--bp-radius-card) border border-dashed border-(--bp-line) p-4 text-left text-sm font-semibold text-(--bp-primary-ink) hover:bg-(--bp-surface)">
            + Add a draft goal
          </button>
        </div>
      )}

      {!model.hydrated ? (
        <div className={`${cardClass} h-64 bp-shimmer`} aria-busy="true" aria-label="Loading" />
      ) : addingGoal ? (
        <div className="space-y-6">
          <Button type="button" variant="outline" onClick={() => setAddingGoal(false)}><ArrowLeft aria-hidden /> Back to goals</Button>
          <WelcomeFlow disabled={false} onFinish={fields => { actions.startGoal(fields); setGoalView("draft"); setAddingGoal(false); }} title="Plan another goal" />
          {goal && <p className={`text-center text-sm ${mutedTextClass}`}>Your existing goals and forecasts stay saved while you add another.</p>}
        </div>
      ) : !goal ? (
        <WelcomeFlow disabled={false} onFinish={actions.startGoal} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <FadeRise index={0} className="lg:sticky lg:top-6 lg:self-start"><GoalCard goal={goal} model={model} /></FadeRise>
          <div className="space-y-6">
            <FadeRise index={1}><Hero goal={goal} valid={valid} result={model.forecastResult} /></FadeRise>
            {goal.status === "active" && forecast && valid && <PaycheckReminder goalName={goal.name} forecast={forecast} />}
            {forecast && valid && (
              <>
                {forecast.plan.affordableNow ? null : (
                  <div className={`space-y-6 ${goal.status === "draft" ? previewClass : ""}`}>
                    <FadeRise index={2}><FundingChart forecast={forecast} costCents={goal.costCents} bufferCents={goal.bufferCents} /></FadeRise>
                    <FadeRise index={3}><PercentChart forecast={forecast} /></FadeRise>
                  </div>
                )}
                <FadeRise index={4}><DeadlineSlider forecast={forecast} deadline={model.deadline ?? forecast.horizonEndDate} needsHelp={model.needsHelp} onChange={actions.setDeadline} onHelp={actions.requestAdvice} /></FadeRise>
                <AdvicePanel model={model} />
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog open={confirm === "deactivate"} onOpenChange={open => !open && setConfirm(null)} title="Switch back to draft?" description="This releases the earmark. Your goal stays saved as a draft." confirmLabel="Move to drafts" onConfirm={() => { actions.setStatus("draft"); setGoalView("draft"); }} />
      <ConfirmDialog open={confirm === "reset"} onOpenChange={open => !open && setConfirm(null)} title="Reset this goal?" description="This clears the name, cost, contribution, and deadline, and restores the default buffer." confirmLabel="Reset" onConfirm={() => actions.reset()} />
    </div>
  );
}

function PaycheckReminder({ goalName, forecast }: { goalName: string; forecast: NonNullable<ReturnType<typeof useBigPurchase>["forecast"]> }) {
  const nextPayday = forecast.funding.find(point => point.date > forecast.asOfDate)?.date;
  return (
    <section aria-label="Paycheck reminder" className={`${cardClass} flex items-start gap-4 border-(--bp-primary)/30 bg-(--bp-bg) p-5`}>
      <CalendarClock aria-hidden className="mt-0.5 size-6 shrink-0 text-(--bp-primary-ink)" />
      <div>
        <h2 className="font-semibold">Paycheck reminder</h2>
        {forecast.plan.affordableNow ? (
          <p className={`mt-1 text-sm ${mutedTextClass}`}>Your {goalName || "goal"} is already affordable. No paycheck set-aside is needed.</p>
        ) : (
          <p className={`mt-1 text-sm ${mutedTextClass}`}>Set aside <strong className="text-(--bp-ink)">{formatUSD(forecast.plan.contributionCents)}</strong> from each paycheck for {goalName || "this goal"}.{nextPayday && <> Next paycheck: <strong className="text-(--bp-ink)">{formatDate(nextPayday, "full")}</strong>.</>}</p>
        )}
      </div>
    </section>
  );
}

function GoalGroup({ title, description, goals, selectedId, onSelect, activeContribution, activeAlreadyAffordable }: {
  title: string;
  description: string;
  goals: { id: string; name: string; costCents: number; status: "draft" | "active" }[];
  selectedId?: string;
  onSelect: (id: string) => void;
  activeContribution?: number;
  activeAlreadyAffordable?: boolean;
}) {
  return (
    <section aria-label={title} className={`${cardClass} space-y-3 p-4`}>
      <div><h2 className="font-semibold">{title}</h2><p className={`mt-1 text-sm ${mutedTextClass}`}>{description}</p></div>
      {goals.length === 0 ? <p className={`text-sm ${mutedTextClass}`}>No {title.toLowerCase()} yet.</p> : (
        <ul className="space-y-2">
          {goals.map(item => (
            <li key={item.id}>
              <button type="button" aria-current={selectedId === item.id ? "true" : undefined} onClick={() => onSelect(item.id)} className={`flex w-full items-center justify-between gap-3 rounded-(--bp-radius-control) border px-3 py-2 text-left ${selectedId === item.id ? "border-(--bp-primary) bg-(--bp-bg)" : "border-(--bp-line) hover:bg-(--bp-bg)"}`}>
                <span className="min-w-0"><span className="block truncate font-medium">{item.name.trim() || "Unnamed goal"}</span><span className={`block text-sm ${mutedTextClass}`}>{item.status === "active" ? activeAlreadyAffordable ? "Full amount is already reserved" : activeContribution !== undefined ? `Set aside ${formatUSD(activeContribution)} per paycheck` : "Calculating set-aside amount…" : "Planned purchase"}</span></span>
                <span className="shrink-0 text-sm font-semibold">{formatUSD(item.costCents)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ErrorCard({ title, message, details }: { title: string; message: string; details: string[] }) {
  return (
    <section role="alert" className={`${cardClass} flex gap-4 p-6`}>
      <TriangleAlert aria-hidden className="size-6 shrink-0 text-(--bp-danger-ink)" />
      <div><h2 className="font-semibold">{title}</h2><p className={`mt-1 ${mutedTextClass}`}>{message}</p>{details.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{details.map(detail => <li key={detail}>{detail}</li>)}</ul>}</div>
    </section>
  );
}

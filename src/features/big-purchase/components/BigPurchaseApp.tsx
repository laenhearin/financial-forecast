"use client";

import { Database, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useBigPurchase } from "../hooks/useBigPurchase";
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
import { StatusSelector } from "./StatusSelector";
import { cardClass, mutedTextClass, previewClass } from "./ui";
import { WelcomeFlow } from "./WelcomeFlow";

export function BigPurchaseApp({ seedDemoGoal }: { seedDemoGoal: boolean }) {
  const model = useBigPurchase({ seedDemoGoal });
  const { scenarioState, goal, forecast, valid, actions } = model;
  const [confirm, setConfirm] = useState<"deactivate" | "reset" | null>(null);
  const scenario = scenarioState.status === "ready" ? scenarioState.scenario : null;

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forecast Fund</h1>
          {scenario && model.isFixture && (
            <p className={`mt-1 flex items-center gap-1.5 text-sm ${mutedTextClass}`}>
              <Database aria-hidden className="size-4" />
              {model.sourceLabel}: {scenario.customerName}, {scenario.label.toLowerCase()} scenario. Not live bank data; includes estimated everyday spending.
            </p>
          )}
        </div>
        {goal && (
          <div className="flex items-center gap-3">
            <StatusSelector
              status={goal.status}
              canActivate={valid}
              onChange={status => (status === "draft" ? setConfirm("deactivate") : actions.setStatus("active"))}
            />
            <ResetButton enabled={canReset(goal)} onClick={() => setConfirm("reset")} />
          </div>
        )}
      </header>

      {scenarioState.status === "error" ? (
        <ErrorCard title="We couldn't load your data" message={scenarioState.message} details={scenarioState.details} />
      ) : scenarioState.status === "loading" || !model.hydrated ? (
        <div className={`${cardClass} h-64 bp-shimmer`} aria-busy="true" aria-label="Loading" />
      ) : !goal ? (
        <WelcomeFlow disabled={!scenario} onFinish={actions.startGoal} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <FadeRise index={0} className="lg:sticky lg:top-6 lg:self-start">
            <GoalCard goal={goal} model={model} />
          </FadeRise>
          <div className="space-y-6">
            <FadeRise index={1}><Hero goal={goal} valid={valid} result={model.forecastResult} /></FadeRise>
            {forecast && valid && (
              <>
                {forecast.plan.affordableNow ? null : (
                  <div className={`space-y-6 ${goal.status === "draft" ? previewClass : ""}`}>
                    <FadeRise index={2}><FundingChart forecast={forecast} costCents={goal.costCents} bufferCents={goal.bufferCents} /></FadeRise>
                    <FadeRise index={3}><PercentChart forecast={forecast} /></FadeRise>
                  </div>
                )}
                <FadeRise index={4}>
                  <DeadlineSlider
                    forecast={forecast}
                    deadline={model.deadline ?? forecast.horizonEndDate}
                    needsHelp={model.needsHelp}
                    onChange={actions.setDeadline}
                    onHelp={actions.requestAdvice}
                  />
                </FadeRise>
                <AdvicePanel model={model} />
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "deactivate"}
        onOpenChange={open => !open && setConfirm(null)}
        title="Switch back to draft?"
        description="This releases the earmark. Your goal stays saved as a draft."
        confirmLabel="Switch to draft"
        onConfirm={() => actions.setStatus("draft")}
      />
      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={open => !open && setConfirm(null)}
        title="Reset this goal?"
        description="This clears the name, cost, contribution, and deadline, and restores the default buffer."
        confirmLabel="Reset"
        onConfirm={() => actions.reset()}
      />
    </div>
  );
}

function ErrorCard({ title, message, details }: { title: string; message: string; details: string[] }) {
  return (
    <section role="alert" className={`${cardClass} flex gap-4 p-6`}>
      <TriangleAlert aria-hidden className="size-6 shrink-0 text-(--bp-danger-ink)" />
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className={`mt-1 ${mutedTextClass}`}>{message}</p>
        {details.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
      </div>
    </section>
  );
}

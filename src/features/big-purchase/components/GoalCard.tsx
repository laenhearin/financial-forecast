"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUSD } from "@/lib/money";
import { GOAL_NAME_MAX_LENGTH } from "../config";
import type { BigPurchaseModel } from "../hooks/useBigPurchase";
import { defaultBufferCents, validateGoal } from "../state/goalStore";
import type { Goal } from "../types";
import { ContributionControl } from "./ContributionControl";
import { MoneyInput } from "./MoneyInput";
import { cardClass, inputClass, linkButtonClass, mutedTextClass } from "./ui";

export function GoalCard({ goal, model }: { goal: Goal; model: BigPurchaseModel }) {
  const errors = validateGoal(goal);
  const { update } = model.actions;
  return (
    <section aria-labelledby="bp-goal-heading" className={`${cardClass} space-y-6 p-6`}>
      <h2 id="bp-goal-heading" className="text-lg font-semibold">Your goal</h2>

      <Field id="bp-name" label="Name" error={errors.name}>
        <Input
          id="bp-name"
          maxLength={GOAL_NAME_MAX_LENGTH}
          value={goal.name}
          placeholder="Laptop"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "bp-name-error" : undefined}
          onChange={event => update({ field: "name", value: event.target.value })}
          className={inputClass}
        />
      </Field>

      <Field id="bp-cost" label="Cost" error={errors.cost}>
        <MoneyInput
          id="bp-cost"
          value={goal.costCents > 0 ? goal.costCents : null}
          placeholder="1800"
          invalid={Boolean(errors.cost)}
          describedBy={errors.cost ? "bp-cost-error" : undefined}
          onChange={cents => update({ field: "cost", value: cents ?? 0 })}
        />
      </Field>

      <Field id="bp-buffer" label="Minimum buffer" error={errors.buffer} help={
        <>
          Cash to keep after the purchase.{" "}
          {goal.bufferIsCustom
            ? <button type="button" className={linkButtonClass} onClick={() => update({ field: "useSuggestedBuffer" })}>Use suggested ({formatUSD(defaultBufferCents(goal.costCents))})</button>
            : <>Following the suggested amount.</>}
        </>
      }>
        <MoneyInput
          id="bp-buffer"
          value={goal.bufferCents}
          invalid={Boolean(errors.buffer)}
          describedBy="bp-buffer-help"
          onChange={cents => update({ field: "buffer", value: cents ?? 0 })}
        />
      </Field>

      <ContributionControl goal={goal} model={model} />
    </section>
  );
}

export function Field({ id, label, error, help, children }: { id: string; label: string; error?: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-semibold">{label}</Label>
      {children}
      {help && <p id={`${id}-help`} className={`text-sm ${mutedTextClass}`}>{help}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-(--bp-danger-ink)">{error}</p>}
    </div>
  );
}

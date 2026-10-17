"use client";

import { ArrowLeft, ArrowRight, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUSD } from "@/lib/money";
import { GOAL_NAME_MAX_LENGTH, MAX_COST_CENTS } from "../config";
import { defaultBufferCents } from "../state/goalStore";
import type { Cents } from "../types";
import { MoneyInput } from "./MoneyInput";
import { Bounce, FadeRise } from "./motion";
import { cardClass, inputClass, mutedTextClass, primaryButtonClass, secondaryButtonClass } from "./ui";

const STEPS = ["Item name", "Cost", "Buffer"];

/** First-visit flow: name, cost, then buffer. Finishing creates a draft goal. */
export function WelcomeFlow({ onFinish, disabled }: { onFinish: (fields: { name: string; costCents: Cents; bufferCents: Cents }) => void; disabled: boolean }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [costCents, setCostCents] = useState<Cents | null>(null);
  const [bufferCents, setBufferCents] = useState<Cents | null>(null);

  const suggestedBuffer = defaultBufferCents(costCents ?? 0);
  const buffer = bufferCents ?? suggestedBuffer;
  const canContinue = [
    name.trim().length > 0,
    costCents !== null && costCents > 0 && costCents <= MAX_COST_CENTS,
    buffer >= 0,
  ][step];

  const next = () => {
    if (!canContinue || disabled) return;
    if (step < 2) setStep(step + 1);
    else onFinish({ name: name.trim(), costCents: costCents!, bufferCents: buffer });
  };

  return (
    <FadeRise className={`${cardClass} mx-auto max-w-2xl overflow-hidden`}>
      <div className="bg-(image:--bp-hero-gradient) px-8 pt-8 pb-6">
        <ShoppingBag aria-hidden className="mb-4 size-8 text-(--bp-primary-ink)" />
        <h2 className="text-2xl font-semibold tracking-tight">Let&apos;s plan your next big purchase.</h2>
        <p className={`mt-2 ${mutedTextClass}`}>Tell us what you&apos;re saving for and we&apos;ll show you when you can afford it.</p>
      </div>
      <form className="space-y-6 px-8 py-7" onSubmit={event => { event.preventDefault(); next(); }}>
        <ol className="flex items-center gap-2" aria-label={`Step ${step + 1} of 3: ${STEPS[step]}`}>
          {STEPS.map((label, index) => (
            <li key={label} aria-hidden className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === step ? "w-8 bg-(--bp-primary)" : index < step ? "w-2.5 bg-(--bp-primary)" : "w-2.5 bg-(--bp-line)"}`} />
          ))}
          <span className={`ml-2 text-sm ${mutedTextClass}`}>Step {step + 1} of 3</span>
        </ol>

        {step === 0 && (
          <div className="space-y-2">
            <Label htmlFor="bp-welcome-name" className="text-base font-semibold">What are you saving for?</Label>
            <Input id="bp-welcome-name" autoFocus maxLength={GOAL_NAME_MAX_LENGTH} value={name} placeholder="Laptop" onChange={event => setName(event.target.value)} className={inputClass} />
          </div>
        )}
        {step === 1 && (
          <div className="space-y-2">
            <Label htmlFor="bp-welcome-cost" className="text-base font-semibold">How much does it cost?</Label>
            <MoneyInput id="bp-welcome-cost" value={costCents} onChange={setCostCents} placeholder="1800" invalid={costCents !== null && (costCents <= 0 || costCents > MAX_COST_CENTS)} />
            <p className={`text-sm ${mutedTextClass}`}>Up to $250,000.</p>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-2">
            <Label htmlFor="bp-welcome-buffer" className="text-base font-semibold">Minimum buffer</Label>
            <MoneyInput id="bp-welcome-buffer" value={buffer} onChange={value => setBufferCents(value ?? 0)} describedBy="bp-welcome-buffer-help" />
            <p id="bp-welcome-buffer-help" className={`text-sm ${mutedTextClass}`}>
              Cash you want left over after buying it. We suggest {formatUSD(suggestedBuffer)}, the higher of $200 or 15% of the cost.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Bounce><Button type="button" variant="outline" className={secondaryButtonClass} onClick={() => setStep(step - 1)}><ArrowLeft aria-hidden /> Back</Button></Bounce>
          ) : <span />}
          <Bounce disabled={!canContinue || disabled}>
            <Button type="submit" className={primaryButtonClass} disabled={!canContinue || disabled}>
              {step < 2 ? <>Next <ArrowRight aria-hidden /></> : "Looks good"}
            </Button>
          </Bounce>
        </div>
      </form>
    </FadeRise>
  );
}

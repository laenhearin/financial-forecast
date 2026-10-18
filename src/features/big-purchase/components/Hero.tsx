"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import type { ForecastResult, Goal } from "../types";
import { cardClass, mutedTextClass, previewClass } from "./ui";

interface HeroText { lead?: string; headline: string; detail?: string; tone: "normal" | "warning" | "empty" }

function heroText(goal: Goal, valid: boolean, result: ForecastResult | null): HeroText {
  if (!valid || !result) return { headline: "Enter a name and cost to see your forecast", tone: "empty" };
  if (!result.ok) return { headline: result.message, tone: "warning" };
  const { plan } = result.forecast;
  if (plan.tier === "alert") return {
    headline: "This plan would leave cash below $0",
    detail: `The lowest projected cash is ${formatUSD(plan.lowestSpendableCents)} on ${formatDate(plan.lowestSpendableDate, "full")}. Review income, bills, and your contribution before committing.`,
    tone: "warning",
  };
  if (plan.affordableNow) return { headline: "You can afford this right now", detail: `Your cash stays above your ${formatUSD(goal.bufferCents)} buffer.`, tone: "normal" };
  if (!plan.affordableDate) return { headline: "Not within the next 5 years at this budget", detail: "Try Help me get there for changes that could bring it within reach.", tone: "warning" };
  return {
    lead: `You can afford ${goal.name.trim()} on`,
    headline: formatDate(plan.affordableDate, "full"),
    detail: `${plan.paycheckCount} paycheck${plan.paycheckCount === 1 ? "" : "s"} of ${formatUSD(plan.contributionCents)}`,
    tone: "normal",
  };
}

export function Hero({ goal, valid, result }: { goal: Goal; valid: boolean; result: ForecastResult | null }) {
  const reduce = useReducedMotion();
  const text = heroText(goal, valid, result);
  const draft = goal.status === "draft";
  return (
    <section aria-label="Forecast" className={`${cardClass} relative overflow-hidden bg-(image:--bp-hero-gradient) p-7`}>
      {draft && <Badge className="absolute top-5 right-5 bg-(--bp-lilac) text-(--bp-ink)">Preview</Badge>}
      <div aria-live="polite" aria-atomic="true" className={draft ? previewClass : undefined}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${text.lead}|${text.headline}|${text.detail}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {text.lead && <p className="text-lg font-medium">{text.lead}</p>}
            <p className={`${text.tone === "empty" ? "text-2xl font-semibold" : "text-(length:--bp-text-hero) leading-tight font-semibold tracking-tight"} ${text.tone === "warning" ? "text-(--bp-danger-ink)" : ""}`}>
              {text.headline}
            </p>
            {text.detail && <p className={`mt-2 ${mutedTextClass}`}>{text.detail}</p>}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cardClass, mutedTextClass } from "@/features/big-purchase/components/ui";
import { formatDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import type { CashBackAnalysis } from "../types";

/** Money left on the table for the window, annualized, with actual vs best. */
export function SavingsHero({ analysis }: { analysis: CashBackAnalysis }) {
  const reduce = useReducedMotion();
  const { rewards, windowDays } = analysis;
  const missed = Math.max(0, rewards.missedCents);
  const range = `${formatDate(analysis.windowStart, "short")} to ${formatDate(analysis.asOfDate, "short")}`;
  return (
    <section aria-labelledby="cb-hero-heading" className={`${cardClass} relative overflow-hidden bg-(image:--bp-hero-gradient) p-7`}>
      <h2 id="cb-hero-heading" className="text-lg font-medium">Money left on the table</h2>
      <p className={`text-sm ${mutedTextClass}`}>Last {windowDays} days · {range}</p>
      <div aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${windowDays}|${missed}|${rewards.actualCents}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3"
          >
            <p className="text-(length:--bp-text-hero) leading-tight font-semibold tracking-tight">{formatUSD(missed)}</p>
            <p className="mt-1 text-lg font-medium">
              {missed > 0 ? <>About {formatUSD(analysis.missedAnnualCents)} a year</> : <>You used your best card every time</>}
            </p>
            <p className={`mt-2 ${mutedTextClass}`}>
              You earned {formatUSD(rewards.actualCents)} in rewards. The best card each time would have earned {formatUSD(rewards.bestCents)}.
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Purchases" value={String(analysis.purchaseCount)} />
        <Stat label="Card spending" value={formatUSD(analysis.spendCents)} />
        <Stat label="Wrong-card purchases" value={String(analysis.flags.length)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--bp-radius-control) bg-(--bp-surface)/70 p-3">
      <dt className={`text-xs ${mutedTextClass}`}>{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

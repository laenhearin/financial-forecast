"use client";

import { CalendarClock, CircleCheck, CircleX, Scissors, TrendingUp, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import type { AdviceItem } from "../types";
import { cardClass, mutedTextClass } from "./ui";

const ICONS: Record<AdviceItem["type"], LucideIcon> = {
  "raise-contribution": TrendingUp,
  "shift-bill": CalendarClock,
  "cut-recurring": CircleX,
  "trim-category": Scissors,
};
const EASE_STYLE: Record<AdviceItem["ease"], string> = {
  easy: "bg-(--bp-mint)",
  medium: "bg-(--bp-butter)",
  hard: "bg-(--bp-peach)",
};

/** One ranked suggestion. Advice only: there is no apply button. */
export function AdviceCard({ item, index }: { item: AdviceItem; index: number }) {
  const reduce = useReducedMotion();
  const Icon = ICONS[item.type];
  return (
    <motion.li
      className={`${cardClass} flex gap-4 p-5`}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--bp-lilac)"><Icon aria-hidden className="size-5" /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold">{item.title}</h4>
          <Badge className={`${EASE_STYLE[item.ease]} text-(--bp-ink) capitalize`}>{item.ease}</Badge>
          {item.meetsDeadline && <Badge className="bg-(--bp-sky) text-(--bp-ink)"><CircleCheck aria-hidden /> Meets deadline</Badge>}
        </div>
        <p className={`text-sm ${mutedTextClass}`}>{item.reason}</p>
        {item.newAffordableDate && (
          <p className="text-sm font-semibold text-(--bp-primary-ink)">
            {item.daysSooner !== null
              ? `${item.daysSooner} days sooner · ${formatDate(item.newAffordableDate, "full")}`
              : `Makes this affordable by ${formatDate(item.newAffordableDate, "full")}`}
          </p>
        )}
      </div>
    </motion.li>
  );
}

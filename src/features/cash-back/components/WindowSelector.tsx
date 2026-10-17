"use client";

import { motion, useReducedMotion } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PILL_SPRING } from "@/features/big-purchase/components/motion";
import { WINDOW_OPTIONS } from "../config";
import type { WindowDays } from "../types";

/** Segmented 30 / 90 day control with a sliding pill. */
export function WindowSelector({ value, onChange }: { value: WindowDays; onChange: (days: WindowDays) => void }) {
  const reduce = useReducedMotion();
  return (
    <ToggleGroup
      aria-label="Time window"
      value={[String(value)]}
      onValueChange={values => {
        const next = Number(values[0]);
        if (next === 30 || next === 90) onChange(next);
      }}
      spacing={0}
      className="rounded-(--bp-radius-control) border border-(--bp-line) bg-(--bp-bg) p-1"
    >
      {WINDOW_OPTIONS.map(days => {
        const selected = days === value;
        return (
          <ToggleGroupItem
            key={days}
            value={String(days)}
            className="relative h-9 min-w-24 rounded-[calc(var(--bp-radius-control)-4px)]! px-4 text-sm font-semibold text-(--bp-muted) hover:bg-transparent aria-pressed:bg-transparent aria-pressed:text-(--bp-ink) data-[state=on]:bg-transparent"
          >
            {selected && (
              <motion.span
                layoutId="cb-window-pill"
                transition={reduce ? { duration: 0 } : PILL_SPRING}
                className="absolute inset-0 rounded-[calc(var(--bp-radius-control)-4px)] bg-(--bp-surface) shadow-(--bp-shadow-pill)"
              />
            )}
            <span className="relative">Last {days} days</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

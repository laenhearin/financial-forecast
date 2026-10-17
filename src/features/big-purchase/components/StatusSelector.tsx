"use client";

import { motion, useReducedMotion } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { GoalStatus } from "../types";
import { PILL_SPRING } from "./motion";

const OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
];

/** Segmented Draft / Active control with a sliding pill. Active stays disabled until the inputs are valid. */
export function StatusSelector({ status, canActivate, onChange }: { status: GoalStatus; canActivate: boolean; onChange: (status: GoalStatus) => void }) {
  const reduce = useReducedMotion();
  return (
    <ToggleGroup
      aria-label="Goal status"
      value={[status]}
      onValueChange={values => {
        const next = values[0] as GoalStatus | undefined;
        if (next && next !== status) onChange(next);
      }}
      spacing={0}
      className="rounded-(--bp-radius-control) border border-(--bp-line) bg-(--bp-bg) p-1"
    >
      {OPTIONS.map(option => {
        const selected = option.value === status;
        const disabled = option.value === "active" && !canActivate && !selected;
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            disabled={disabled}
            title={disabled ? "Enter a name and cost to activate" : undefined}
            className="relative h-9 min-w-20 rounded-[calc(var(--bp-radius-control)-4px)]! px-4 text-sm font-semibold text-(--bp-muted) hover:bg-transparent aria-pressed:bg-transparent aria-pressed:text-(--bp-ink) data-[state=on]:bg-transparent"
          >
            {selected && (
              <motion.span
                layoutId="bp-status-pill"
                transition={reduce ? { duration: 0 } : PILL_SPRING}
                className={`absolute inset-0 rounded-[calc(var(--bp-radius-control)-4px)] shadow-(--bp-shadow-pill) ${option.value === "active" ? "bg-(--bp-mint)" : "bg-(--bp-surface)"}`}
              />
            )}
            <span className="relative">{option.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

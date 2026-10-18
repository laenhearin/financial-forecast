"use client";

import { useReduceMotion } from "@/features/nimbus/hooks/useReduceMotion";
import { cn } from "@/lib/utils";

/** The "Reduce motion" setting. Applies at once, in every tab; defaults to the system preference. */
export function ReduceMotionSwitch({ labelledBy, describedBy }: { labelledBy: string; describedBy?: string }) {
  const { reduceMotion, setReduceMotion } = useReduceMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={reduceMotion}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => setReduceMotion(!reduceMotion)}
      className={cn(
        "ui-transition relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-app",
        reduceMotion ? "bg-primary" : "bg-card",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-3.5 rounded-full shadow-sm",
          reduceMotion ? "translate-x-4.5 bg-primary-foreground" : "translate-x-0.5 bg-white transition-transform duration-150",
        )}
      />
    </button>
  );
}

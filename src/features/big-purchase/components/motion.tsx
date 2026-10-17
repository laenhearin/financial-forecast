"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const BUTTON_SPRING = { type: "spring", stiffness: 520, damping: 16, mass: 0.6 } as const;
export const PILL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/** Springy hover and press for any button inside. Off for disabled buttons and reduced motion. */
export function Bounce({ children, disabled = false, className }: { children: React.ReactNode; disabled?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const active = !reduce && !disabled;
  return (
    <motion.span
      className={cn("inline-flex", className)}
      whileHover={active ? { scale: 1.03 } : undefined}
      whileTap={active ? { scale: 0.95 } : undefined}
      transition={BUTTON_SPRING}
    >
      {children}
    </motion.span>
  );
}

/** Cards fade in and rise 12px over 350ms, staggered 60ms by index. */
export function FadeRise({ index = 0, children, className }: { index?: number; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Charts draw in over 700ms on first view, then animate updates over 300ms; none with reduced motion. */
export function useChartAnimation() {
  const reduce = useReducedMotion();
  const [firstView, setFirstView] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setFirstView(false), 800);
    return () => clearTimeout(timer);
  }, []);
  return { isAnimationActive: !reduce, animationDuration: firstView ? 700 : 300 };
}

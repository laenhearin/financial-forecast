"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { THEMES } from "@/lib/config";
import { cn } from "@/lib/utils";

const subscribeNever = () => () => {};

/** False during server rendering and hydration, true afterwards. */
function useHasMounted() {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

/** Switches between Clear Skies and Heavy Rain. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const isHeavyRain = mounted && resolvedTheme === THEMES.heavyRain;
  const Icon = isHeavyRain ? Sun : Moon;

  return (
    <button
      type="button"
      aria-label={isHeavyRain ? "Switch to Clear Skies theme" : "Switch to Heavy Rain theme"}
      title={isHeavyRain ? "Switch to Clear Skies" : "Switch to Heavy Rain"}
      onClick={() => setTheme(isHeavyRain ? THEMES.clearSky : THEMES.heavyRain)}
      className={cn(
        "ui-transition inline-flex size-8 shrink-0 items-center justify-center rounded-item text-secondary hover:bg-nav-hover hover:text-primary",
        className,
      )}
    >
      {/* The saved theme is only known on the client, so the icon waits for mount. */}
      {mounted ? <Icon aria-hidden className="size-4.5" strokeWidth={1.75} /> : <span className="size-4.5" />}
    </button>
  );
}

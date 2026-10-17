"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { THEME_NAMES, THEMES } from "@/lib/config";

/**
 * next-themes writes the saved theme to <html data-theme> with an inline script before paint.
 * The script type is swapped on the client so React does not warn about rendering <script>
 * (the approach in Next's "Preventing flash before hydration" guide).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      themes={THEME_NAMES}
      defaultTheme={THEMES.clearSky}
      enableSystem={false}
      disableTransitionOnChange
      scriptProps={{ type: typeof window === "undefined" ? "text/javascript" : "text/plain" }}
    >
      {children}
    </NextThemesProvider>
  );
}

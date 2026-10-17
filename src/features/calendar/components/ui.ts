import type { AdviceTone } from "../types";

/** Shared classes for the calendar page, built only from the app theme tokens. */
export const panelClass = "min-w-0 rounded-panel border border-app bg-card p-5.5";
export const panelTitleClass = "text-figure font-semibold text-primary";
export const subtitleClass = "mt-1 text-caption text-secondary";
export const noteClass = "mt-3 text-micro text-secondary";
export const labelClass = "mb-1.5 block text-caption font-medium text-secondary";
export const inputClass =
  "ui-transition w-full rounded-item border border-app bg-card px-3 py-2.5 text-body text-primary placeholder:text-secondary hover:border-accent-line";
export const primaryButtonClass =
  "ui-transition w-full rounded-item border border-accent-line bg-accent-soft px-3 py-3 text-body font-medium text-primary hover:bg-nav-active";
export const secondaryButtonClass =
  "ui-transition inline-flex items-center justify-center rounded-item border border-app bg-card px-3 py-2 text-body text-primary hover:bg-nav-hover";
export const removeButtonClass = "ui-transition text-micro font-medium text-neg hover:underline";

/** Tinted backgrounds for advice tags and status boxes. Text stays text-primary for contrast. */
export const TONE_BG: Record<AdviceTone, string> = {
  high: "bg-neg-soft",
  medium: "bg-rain-soft",
  ok: "bg-pos-soft",
  info: "bg-accent-soft",
};

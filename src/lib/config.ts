export const APP_NAME = "CloudCash";

/** Theme names as stored by next-themes and written to <html data-theme>. */
export const THEMES = {
  clearSky: "clear-sky",
  heavyRain: "heavy-rain",
} as const;

export type ThemeName = (typeof THEMES)[keyof typeof THEMES];

export const THEME_NAMES: ThemeName[] = [THEMES.clearSky, THEMES.heavyRain];

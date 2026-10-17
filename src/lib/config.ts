/** Placeholder brand and user until the real names are decided. */
export const APP_NAME = "App name";
export const USER_NAME = "Alex";

/** Theme names as stored by next-themes and written to <html data-theme>. */
export const THEMES = {
  clearSky: "clear-sky",
  midnight: "midnight",
} as const;

export type ThemeName = (typeof THEMES)[keyof typeof THEMES];

export const THEME_NAMES: ThemeName[] = [THEMES.clearSky, THEMES.midnight];

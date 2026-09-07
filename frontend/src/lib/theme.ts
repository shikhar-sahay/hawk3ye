import type { useTheme } from "next-themes";

export type HawkeyeTheme = "light" | "dark" | "black";

export const HAWKEYE_THEMES: Array<{
  value: HawkeyeTheme;
  label: string;
  description: string;
}> = [
  { value: "light", label: "Light", description: "Cool neutral, white surfaces" },
  { value: "dark", label: "Deep Blue", description: "Layered slate, the Hawk3ye classic" },
  { value: "black", label: "Pitch Black", description: "True black, high contrast" },
];

/**
 * Applies a theme with a short, restrained color transition. The global
 * reduced-motion override in index.css disables the transition entirely
 * for users who prefer reduced motion.
 */
export function setThemeAnimated(
  setTheme: ReturnType<typeof useTheme>["setTheme"],
  theme: HawkeyeTheme
) {
  const root = document.documentElement;
  root.classList.add("theme-anim");
  setTheme(theme);
  window.setTimeout(() => root.classList.remove("theme-anim"), 300);
}

"use client";

import { createContext, useContext } from "react";
import { type AccentColorKey, DEFAULT_ACCENT } from "@/lib/accent-colors";

export type ThemeMode = "light" | "dark" | "system";

export type ThemeContextType = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accentColor: AccentColorKey;
  setAccentColor: (key: AccentColorKey) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  mode: "system",
  setMode: () => {},
  accentColor: DEFAULT_ACCENT,
  setAccentColor: () => {},
});

export function useThemeMode() {
  return useContext(ThemeContext);
}

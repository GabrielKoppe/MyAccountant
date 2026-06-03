"use client";

import { useState, useMemo, type ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ThemeProvider } from "@mui/material/styles";

import { buildThemeWithAccent } from "@/lib/theme";
import { type AccentColorKey, DEFAULT_ACCENT } from "@/lib/accent-colors";
import { ThemeContext, type ThemeMode } from "./ThemeContext";
import { saveThemeAction, saveAccentColorAction } from "@/actions/user-settings";

type Props = {
  initialMode?: ThemeMode;
  initialAccentColor?: AccentColorKey;
  children: ReactNode;
};

export function ThemeProviderClient({
  initialMode = "system",
  initialAccentColor = DEFAULT_ACCENT,
  children,
}: Props) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [accentColor, setAccentColorState] = useState<AccentColorKey>(initialAccentColor);

  // noSsr omitted intentionally: avoids Emotion class hash mismatches on hydration.
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const resolvedMode: "light" | "dark" =
    mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  const muiTheme = useMemo(
    () => buildThemeWithAccent(resolvedMode, accentColor),
    [resolvedMode, accentColor],
  );

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    document.cookie = `theme=${newMode};path=/;max-age=31536000;samesite=strict`;
    saveThemeAction(newMode).catch(() => {});
  }

  function setAccentColor(key: AccentColorKey) {
    setAccentColorState(key);
    document.cookie = `accent_color=${key};path=/;max-age=31536000;samesite=strict`;
    saveAccentColorAction(key).catch(() => {});
  }

  return (
    <ThemeContext.Provider value={{ mode, setMode, accentColor, setAccentColor }}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

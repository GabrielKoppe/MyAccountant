"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
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

  // O servidor não tem acesso a matchMedia, então renderiza "system" como light.
  // No MUI v6 o useMediaQuery usa useSyncExternalStore e lê o matchMedia ao vivo
  // já na primeira renderização do client — se o SO estiver em dark, o primeiro
  // render do client sai dark enquanto o SSR veio light, e TODOS os hashes de
  // classe do Emotion divergem (hydration mismatch). Para o modo "system" só
  // aplicamos a preferência do SO após montar, garantindo que o primeiro render
  // do client seja idêntico ao SSR. Modos explícitos (light/dark) não precisam
  // disso: já coincidem entre servidor e client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { defaultMatches: false });
  const systemDark = mounted && prefersDark;

  const resolvedMode: "light" | "dark" =
    mode === "system" ? (systemDark ? "dark" : "light") : mode;

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

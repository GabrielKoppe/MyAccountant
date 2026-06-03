"use client";

import { SnackbarProvider } from "notistack";
import type { ReactNode } from "react";

import { ThemeProviderClient } from "./ThemeProviderClient";
import type { ThemeMode } from "./ThemeContext";
import type { AccentColorKey } from "@/lib/accent-colors";

type Props = {
  initialTheme?: ThemeMode;
  initialAccentColor?: AccentColorKey;
  children: ReactNode;
};

export function AppProviders({ initialTheme = "system", initialAccentColor, children }: Props) {
  return (
    <ThemeProviderClient initialMode={initialTheme} initialAccentColor={initialAccentColor}>
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        autoHideDuration={4000}
      >
        {children}
      </SnackbarProvider>
    </ThemeProviderClient>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

import { AppProviders } from "@/components/providers/AppProviders";
import type { ThemeMode } from "@/components/providers/ThemeContext";
import { type AccentColorKey, ACCENT_COLOR_KEYS, DEFAULT_ACCENT } from "@/lib/accent-colors";
import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import "@/lib/zod-config"; // configura mensagens Zod em pt-BR

import "./globals.css";

export const metadata: Metadata = {
  title: "MyAccountant",
  description: "Organizacao financeira colaborativa",
};

function parseTheme(value: string | undefined): ThemeMode | null {
  if (value === "light" || value === "dark" || value === "system") return value;
  return null;
}

function parseAccent(value: string | undefined): AccentColorKey | null {
  if (!value) return null;
  return (ACCENT_COLOR_KEYS as readonly string[]).includes(value)
    ? (value as AccentColorKey)
    : null;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = parseTheme(cookieStore.get("theme")?.value);
  const cookieAccent = parseAccent(cookieStore.get("accent_color")?.value);

  let initialTheme: ThemeMode = cookieTheme ?? "system";
  let initialAccentColor: AccentColorKey = cookieAccent ?? DEFAULT_ACCENT;

  // If either preference is missing from cookies, fall back to DB (cross-device sync)
  if (!cookieTheme || !cookieAccent) {
    const session = await auth();
    if (session?.user?.id) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { theme: true, accentColor: true },
      });
      if (!cookieTheme) initialTheme = parseTheme(settings?.theme) ?? "system";
      if (!cookieAccent) initialAccentColor = parseAccent(settings?.accentColor) ?? DEFAULT_ACCENT;
    }
  }

  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AppRouterCacheProvider>
          <AppProviders initialTheme={initialTheme} initialAccentColor={initialAccentColor}>
            {children}
          </AppProviders>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

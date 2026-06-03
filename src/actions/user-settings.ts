"use server";

import { cookies } from "next/headers";
import { auth } from "@/server/auth";
import { prisma } from "@/server/prisma";
import type { ThemeMode } from "@/components/providers/ThemeContext";
import { type AccentColorKey, ACCENT_COLOR_KEYS } from "@/lib/accent-colors";

export async function saveThemeAction(theme: ThemeMode): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "strict",
    httpOnly: false,
  });

  const session = await auth();
  if (session?.user?.id) {
    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: { theme },
      create: { userId: session.user.id, theme },
    });
  }
}

export async function saveAccentColorAction(accentColor: AccentColorKey): Promise<void> {
  if (!(ACCENT_COLOR_KEYS as readonly string[]).includes(accentColor)) return;

  const cookieStore = await cookies();
  cookieStore.set("accent_color", accentColor, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "strict",
    httpOnly: false,
  });

  const session = await auth();
  if (session?.user?.id) {
    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: { accentColor },
      create: { userId: session.user.id, accentColor },
    });
  }
}

"use server";

import { cookies } from "next/headers";

import type { ThemeMode } from "@/components/providers/ThemeContext";
import { type AccentColorKey, ACCENT_COLOR_KEYS } from "@/lib/accent-colors";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar-preference";
import { auth } from "@/server/auth";
import * as userSettingsService from "@/server/services/user-settings-service";

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
    await userSettingsService.saveTheme(session.user.id, theme);
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
    await userSettingsService.saveAccentColor(session.user.id, accentColor);
  }
}

// Spec 65 §7.4/§10.3 (P3) — persistência do estado recolhido da sidebar
// (NAV-05). Espelha o mecanismo de cookie de `saveThemeAction`/
// `saveAccentColorAction` acima, mas SEM `auth()`/DB: a sincronização com
// `UserSettings` fica fora de escopo (cookie basta, evita migração de schema
// — ver §7.4).
export async function saveSidebarCollapsedAction(collapsed: boolean): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SIDEBAR_COLLAPSED_COOKIE, collapsed ? "1" : "0", {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "strict",
    httpOnly: false,
  });
}

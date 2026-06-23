import type { ThemeMode } from "@/components/providers/ThemeContext";
import type { AccentColorKey } from "@/lib/accent-colors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "user-settings-service" });

export async function saveTheme(userId: string, theme: ThemeMode): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    update: { theme },
    create: { userId, theme },
  });
  log.info({ userId }, "Theme saved");
}

export async function saveAccentColor(userId: string, accentColor: AccentColorKey): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    update: { accentColor },
    create: { userId, accentColor },
  });
  log.info({ userId }, "Accent color saved");
}

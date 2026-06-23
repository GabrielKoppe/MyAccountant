import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { ActionContext } from "@/server/api/define-action";

const log = logger.child({ module: "onboarding-service" });

export async function completeOnboarding(ctx: ActionContext): Promise<void> {
  await prisma.accountSettings.update({
    where: { accountId: ctx.accountId },
    data: { onboardingCompletedAt: new Date() },
  });
  log.info({ accountId: ctx.accountId }, "Onboarding completed");
}

export async function resetOnboarding(ctx: ActionContext): Promise<void> {
  await prisma.accountSettings.update({
    where: { accountId: ctx.accountId },
    data: { onboardingCompletedAt: null },
  });
  log.info({ accountId: ctx.accountId }, "Onboarding reset");
}

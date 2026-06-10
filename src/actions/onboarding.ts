"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import { prisma } from "@/server/prisma";

// Operações simples de campo único — lógica fica aqui mesmo por ser trivial
export const completeOnboardingAction = defineAction({
  schema: z.object({}),
  requireRoles: ["owner", "editor"],
  handler: async (_, ctx) => {
    await prisma.accountSettings.update({
      where: { accountId: ctx.accountId },
      data: { onboardingCompletedAt: new Date() },
    });
    revalidatePath(`/${ctx.accountId}`);
    revalidatePath(`/${ctx.accountId}/setup`);
  },
});

export const resetOnboardingAction = defineAction({
  schema: z.object({}),
  requireRoles: ["owner"],
  handler: async (_, ctx) => {
    await prisma.accountSettings.update({
      where: { accountId: ctx.accountId },
      data: { onboardingCompletedAt: null },
    });
    revalidatePath(`/${ctx.accountId}/settings/general`);
    revalidatePath(`/${ctx.accountId}`);
  },
});

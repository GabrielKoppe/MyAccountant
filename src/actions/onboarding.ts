"use server";

import { revalidateAccountHome } from "@/server/api/revalidate";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import * as onboardingService from "@/server/services/onboarding-service";

export const completeOnboardingAction = defineAction({
  schema: z.object({}),
  requireRoles: ["owner", "editor"],
  handler: async (_, ctx) => {
    await onboardingService.completeOnboarding(ctx);
    revalidateAccountHome(ctx.accountId);
    revalidateAccountHome(ctx.accountId); // setup redirects para home
  },
});

export const resetOnboardingAction = defineAction({
  schema: z.object({}),
  requireRoles: ["owner"],
  handler: async (_, ctx) => {
    await onboardingService.resetOnboarding(ctx);
    // revalidateGeneralSettings já cobre general + home
    revalidateAccountHome(ctx.accountId);
  },
});

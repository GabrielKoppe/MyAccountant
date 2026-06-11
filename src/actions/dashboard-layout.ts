"use server";

import { revalidatePath } from "next/cache";

import { defineAction } from "@/server/api/define-action";
import { updateDashboardLayoutSchema } from "@/lib/schemas/dashboard-layout";
import * as dashboardLayoutService from "@/server/services/dashboard-layout-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const updateDashboardLayoutAction = defineAction({
  schema: updateDashboardLayoutSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await dashboardLayoutService.upsertLayout(input, ctx);
    // Invalida dashboards (RSCs cacheados) e a própria página de settings
    revalidatePath(`/${ctx.accountId}/dashboards`, "layout");
    revalidatePath(`/${ctx.accountId}/settings/dashboards`, "layout");
    revalidatePath(`/${ctx.accountId}/months`, "layout");
  },
});

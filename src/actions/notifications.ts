"use server";

import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import * as notificationService from "@/server/services/notification-service";

export const listAndMarkAllReadAction = defineAction({
  schema: z.object({}),
  handler: async (_input, ctx) => {
    return notificationService.listAndMarkAllRead(ctx.userId, ctx.accountId);
  },
});

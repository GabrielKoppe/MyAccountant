"use server";

import { createMonthSchema, deleteMonthSchema } from "@/lib/schemas/months";
import { defineAction } from "@/server/api/define-action";
import * as monthService from "@/server/services/month-service";

export const createMonthAction = defineAction({
  schema: createMonthSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const result = await monthService.createMonth(input, ctx);
    return result;
  },
});

export const deleteMonthAction = defineAction({
  schema: deleteMonthSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await monthService.deleteMonth(input, ctx);
  },
});

"use server";

import { z } from "zod";

import { cuidSchema } from "@/lib/schemas/shared";
import { defineAction } from "@/server/api/define-action";
import { getTransactionsByIds } from "@/server/queries/dashboards";

export const getDrawerTransactionsAction = defineAction({
  schema: z.array(cuidSchema),
  handler: async (ids, ctx) => {
    return getTransactionsByIds(ctx.accountId, ids);
  },
});

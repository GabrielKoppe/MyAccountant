"use server";

import { z } from "zod";
import { defineAction } from "@/server/api/define-action";
import { getTransactionsByIds } from "@/server/queries/dashboards";

export const getDrawerTransactionsAction = defineAction({
  schema: z.array(z.string().cuid()),
  handler: async (ids, ctx) => {
    return getTransactionsByIds(ctx.accountId, ids);
  },
});

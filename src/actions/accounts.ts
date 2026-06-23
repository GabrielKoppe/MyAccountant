"use server";

import { defineUserAction } from "@/server/api/define-action";
import { createAccount } from "@/server/services/account-service";

import { createAccountSchema } from "@/lib/schemas/account";

export const createAccountAction = defineUserAction({
  schema: createAccountSchema,
  handler: async (input, ctx) => {
    const account = await createAccount({ ...input, createdById: ctx.userId });
    return { accountId: account.id };
  },
});

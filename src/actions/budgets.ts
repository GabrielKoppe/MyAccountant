"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import { createBudgetSchema, updateBudgetSchema, deleteBudgetSchema } from "@/lib/schemas/budget";
import * as budgetService from "@/server/services/budget-service";
import { getBudgetsForSettings } from "@/lib/queries/budgets";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createBudgetAction = defineAction({
  schema: createBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await budgetService.createBudget(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/budgets`);
    updateTag(`account:${ctx.accountId}`); // invalida cache de insights (metas mudaram)
    return result;
  },
});

export const updateBudgetAction = defineAction({
  schema: updateBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await budgetService.updateBudget(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/budgets`);
    updateTag(`account:${ctx.accountId}`);
  },
});

export const deleteBudgetAction = defineAction({
  schema: deleteBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await budgetService.deleteBudget(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/budgets`);
    updateTag(`account:${ctx.accountId}`);
  },
});

export const listBudgetsAction = defineAction({
  schema: z.object({}),
  handler: async (_input, ctx) => {
    return getBudgetsForSettings(ctx.accountId);
  },
});

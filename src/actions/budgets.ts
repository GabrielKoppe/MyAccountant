"use server";

import { updateTag } from "next/cache";
import { revalidateBudgets } from "@/server/api/revalidate";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import { createBudgetSchema, updateBudgetSchema, deleteBudgetSchema } from "@/lib/schemas/budget";
import * as budgetService from "@/server/services/budget-service";
import { getBudgetsForSettings } from "@/server/queries/budgets";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createBudgetAction = defineAction({
  schema: createBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await budgetService.createBudget(input, ctx);
    revalidateBudgets(ctx.accountId);
    updateTag(`account:${ctx.accountId}`); // invalida cache de insights (metas mudaram)
    return result;
  },
});

export const updateBudgetAction = defineAction({
  schema: updateBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await budgetService.updateBudget(input, ctx);
    revalidateBudgets(ctx.accountId);
    updateTag(`account:${ctx.accountId}`);
  },
});

export const deleteBudgetAction = defineAction({
  schema: deleteBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await budgetService.deleteBudget(input, ctx);
    revalidateBudgets(ctx.accountId);
    updateTag(`account:${ctx.accountId}`);
  },
});

export const listBudgetsAction = defineAction({
  schema: z.object({}),
  handler: async (_input, ctx) => {
    return getBudgetsForSettings(ctx.accountId);
  },
});

// ─── Budget Transaction Details ───────────────────────────────────────────────

export type { BudgetTxRow, BudgetTxDetail } from "@/server/services/budget-service";

export const getBudgetTransactionsAction = defineAction({
  schema: z.object({ budgetId: z.string().cuid(), monthId: z.string().cuid() }),
  handler: async ({ budgetId, monthId }, ctx) => budgetService.getBudgetTransactions({ budgetId, monthId }, ctx),
});

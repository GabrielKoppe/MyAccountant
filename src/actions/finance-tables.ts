"use server";

import { revalidatePath } from "next/cache";

import { defineAction } from "@/server/api/define-action";
import {
  createFinanceTableSchema,
  deleteFinanceTableSchema,
  reorderFinanceTablesSchema,
  updateFinanceTableSchema,
} from "@/lib/schemas/finance-table";
import * as financeTableService from "@/server/services/finance-table-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createFinanceTableAction = defineAction({
  schema: createFinanceTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await financeTableService.createFinanceTable(input, ctx);
    revalidatePath(`/${ctx.accountId}/months/${input.monthId}`);
    return result;
  },
});

export const updateFinanceTableAction = defineAction({
  schema: updateFinanceTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await financeTableService.updateFinanceTable(input, ctx);
    // Revalida o mês atual — sem saber qual monthId, revalida a account toda
    revalidatePath(`/${ctx.accountId}`, "layout");
  },
});

export const deleteFinanceTableAction = defineAction({
  schema: deleteFinanceTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await financeTableService.deleteFinanceTable(input, ctx);
    revalidatePath(`/${ctx.accountId}`, "layout");
  },
});

export const reorderFinanceTablesAction = defineAction({
  schema: reorderFinanceTablesSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await financeTableService.reorderFinanceTables(input, ctx);
    revalidatePath(`/${ctx.accountId}/months/${input.monthId}`);
  },
});

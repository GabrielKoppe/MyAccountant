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

function revalidateMonth(accountId: string, monthId: string) {
  revalidatePath(`/${accountId}/months/${monthId}`);
  revalidatePath(`/${accountId}/dashboards/monthly/${monthId}`);
}

export const createFinanceTableAction = defineAction({
  schema: createFinanceTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await financeTableService.createFinanceTable(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);
    return result;
  },
});

export const updateFinanceTableAction = defineAction({
  schema: updateFinanceTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const { monthId } = await financeTableService.updateFinanceTable(input, ctx);
    revalidateMonth(ctx.accountId, monthId);
  },
});

export const deleteFinanceTableAction = defineAction({
  schema: deleteFinanceTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const { monthId } = await financeTableService.deleteFinanceTable(input, ctx);
    revalidateMonth(ctx.accountId, monthId);
  },
});

export const reorderFinanceTablesAction = defineAction({
  schema: reorderFinanceTablesSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await financeTableService.reorderFinanceTables(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);
  },
});

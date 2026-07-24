"use server";

import {
  bulkDeleteSchema,
  bulkUpdateSchema,
  createTransactionSchema,
  deleteTransactionSchema,
  duplicateTransactionSchema,
  listTablesForMoveSchema,
  moveTransactionsSchema,
  updateTransactionSchema,
} from "@/lib/schemas/transaction";
import { defineAction } from "@/server/api/define-action";
import { revalidateMonth } from "@/server/api/revalidate";
import * as txService from "@/server/services/transaction-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createTransactionAction = defineAction({
  schema: createTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await txService.createTransaction(input, ctx);
    revalidateMonth(ctx.accountId, result.monthId);
    return { transactionId: result.transactionId };
  },
});

export const updateTransactionAction = defineAction({
  schema: updateTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const { monthId } = await txService.updateTransaction(input, ctx);
    revalidateMonth(ctx.accountId, monthId);
  },
});

export const deleteTransactionAction = defineAction({
  schema: deleteTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const { monthId } = await txService.deleteTransaction(input, ctx);
    revalidateMonth(ctx.accountId, monthId);
  },
});

export const duplicateTransactionAction = defineAction({
  schema: duplicateTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await txService.duplicateTransaction(input, ctx);
    revalidateMonth(ctx.accountId, result.monthId);
    return { transactionId: result.transactionId };
  },
});

export const bulkDeleteAction = defineAction({
  schema: bulkDeleteSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const { uniqueMonthIds } = await txService.bulkDelete(input, ctx);
    for (const monthId of uniqueMonthIds) {
      revalidateMonth(ctx.accountId, monthId);
    }
  },
});

export const bulkUpdateAction = defineAction({
  schema: bulkUpdateSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await txService.bulkUpdate(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);
  },
});

export const moveTransactionsAction = defineAction({
  schema: moveTransactionsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await txService.moveTransactions(input, ctx);
    revalidateMonth(ctx.accountId, input.sourceMonthId);
    revalidateMonth(ctx.accountId, result.targetMonthId);
    return result;
  },
});

export const listTablesForMoveAction = defineAction({
  schema: listTablesForMoveSchema,
  handler: async (_input, ctx) => {
    return txService.listTablesForMove(ctx.accountId);
  },
});

"use server";

import { revalidatePath, updateTag } from "next/cache";

import { defineAction } from "@/server/api/define-action";
import { z } from "zod";
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
import * as txService from "@/server/services/transaction-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createTransactionAction = defineAction({
  schema: createTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await txService.createTransaction(input, ctx);
    revalidatePath(`/${ctx.accountId}`, "layout");
    updateTag(`account:${ctx.accountId}`);
    return result;
  },
});

export const updateTransactionAction = defineAction({
  schema: updateTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await txService.updateTransaction(input, ctx);
    revalidatePath(`/${ctx.accountId}`, "layout");
    updateTag(`account:${ctx.accountId}`);
  },
});

export const deleteTransactionAction = defineAction({
  schema: deleteTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await txService.deleteTransaction(input, ctx);
    revalidatePath(`/${ctx.accountId}`, "layout");
    updateTag(`account:${ctx.accountId}`);
  },
});

export const duplicateTransactionAction = defineAction({
  schema: duplicateTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await txService.duplicateTransaction(input, ctx);
    revalidatePath(`/${ctx.accountId}`, "layout");
    updateTag(`account:${ctx.accountId}`);
    return result;
  },
});

export const bulkDeleteAction = defineAction({
  schema: bulkDeleteSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await txService.bulkDelete(input, ctx);
    revalidatePath(`/${ctx.accountId}`, "layout");
    updateTag(`account:${ctx.accountId}`);
  },
});

export const bulkUpdateAction = defineAction({
  schema: bulkUpdateSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await txService.bulkUpdate(input, ctx);
    revalidatePath(`/${ctx.accountId}`, "layout");
    updateTag(`account:${ctx.accountId}`);
  },
});

export const moveTransactionsAction = defineAction({
  schema: moveTransactionsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await txService.moveTransactions(input, ctx);
    // Revalida o layout inteiro para cobrir mês de origem e destino
    revalidatePath(`/${ctx.accountId}`, "layout");
    updateTag(`account:${ctx.accountId}`);
    return result;
  },
});

export const listTablesForMoveAction = defineAction({
  schema: listTablesForMoveSchema,
  handler: async (_input, ctx) => {
    return txService.listTablesForMove(ctx.accountId);
  },
});

"use server";

import {
  archiveTransactionAliasSchema,
  createTransactionAliasSchema,
  deleteTransactionAliasSchema,
  updateTransactionAliasSchema,
} from "@/lib/schemas/transaction-alias";
import { defineAction } from "@/server/api/define-action";
import { revalidateTransactionAliases } from "@/server/api/revalidate";
import * as svc from "@/server/services/transaction-alias-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createTransactionAliasAction = defineAction({
  schema: createTransactionAliasSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await svc.createTransactionAlias(input, ctx);
    revalidateTransactionAliases(ctx.accountId);
    return result;
  },
});

export const updateTransactionAliasAction = defineAction({
  schema: updateTransactionAliasSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.updateTransactionAlias(input, ctx);
    revalidateTransactionAliases(ctx.accountId);
  },
});

export const archiveTransactionAliasAction = defineAction({
  schema: archiveTransactionAliasSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.archiveTransactionAlias(input, ctx);
    revalidateTransactionAliases(ctx.accountId);
  },
});

export const deleteTransactionAliasAction = defineAction({
  schema: deleteTransactionAliasSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.deleteTransactionAlias(input, ctx);
    revalidateTransactionAliases(ctx.accountId);
  },
});

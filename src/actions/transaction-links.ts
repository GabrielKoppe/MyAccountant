"use server";

import { defineAction } from "@/server/api/define-action";
import {
  createTransactionLinkSchema,
  deleteTransactionLinkSchema,
  listLinksForTransactionSchema,
  searchTransactionsForLinkSchema,
  getMonthsForLinkSchema,
  getSectionsTablesSchema,
} from "@/lib/schemas/transaction-link";
import * as linkService from "@/server/services/transaction-link-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createTransactionLinkAction = defineAction({
  schema: createTransactionLinkSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    return linkService.createLink(input, ctx);
  },
});

export const deleteTransactionLinkAction = defineAction({
  schema: deleteTransactionLinkSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await linkService.deleteLink(input, ctx);
  },
});

export const listLinksForTransactionAction = defineAction({
  schema: listLinksForTransactionSchema,
  handler: async (input, ctx) => {
    return linkService.listLinksForTransaction(input.transactionId, ctx);
  },
});

export const searchTransactionsForLinkAction = defineAction({
  schema: searchTransactionsForLinkSchema,
  handler: async (input, ctx) => {
    return linkService.searchTransactionsForLink(
      input.query,
      input.excludeTransactionId,
      input.tableId,
      ctx,
    );
  },
});

export const getMonthsForLinkAction = defineAction({
  schema: getMonthsForLinkSchema,
  handler: async (_input, ctx) => {
    return linkService.getMonthsForLink(ctx);
  },
});

export const getSectionsTablesForLinkAction = defineAction({
  schema: getSectionsTablesSchema,
  handler: async (input, ctx) => {
    return linkService.getSectionsTablesForLink(input.monthId, ctx);
  },
});

"use server";

import {
  createChecklistItemSchema,
  deleteChecklistItemSchema,
  linkChecklistTransactionSchema,
  reorderChecklistSchema,
  searchChecklistTransactionsSchema,
  toggleChecklistCompletionSchema,
  unlinkChecklistTransactionSchema,
  updateChecklistItemSchema,
} from "@/lib/schemas/checklist";
import { defineAction } from "@/server/api/define-action";
import { revalidateChecklist, revalidateMonth } from "@/server/api/revalidate";
import * as checklistService from "@/server/services/checklist-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createChecklistItemAction = defineAction({
  schema: createChecklistItemSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await checklistService.createChecklistItem(input, ctx);
    revalidateChecklist(ctx.accountId);
    // Inline-add pelo widget (B1): item novo deve aparecer no mês atual.
    if (input.monthId) revalidateMonth(ctx.accountId, input.monthId);
    return result;
  },
});

export const updateChecklistItemAction = defineAction({
  schema: updateChecklistItemSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await checklistService.updateChecklistItem(input, ctx);
    revalidateChecklist(ctx.accountId);
  },
});

export const deleteChecklistItemAction = defineAction({
  schema: deleteChecklistItemSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await checklistService.deleteChecklistItem(input, ctx);
    revalidateChecklist(ctx.accountId);
    if (input.monthId) revalidateMonth(ctx.accountId, input.monthId);
  },
});

export const reorderChecklistAction = defineAction({
  schema: reorderChecklistSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await checklistService.reorderChecklist(input, ctx);
    revalidateChecklist(ctx.accountId);
  },
});

export const toggleChecklistCompletionAction = defineAction({
  schema: toggleChecklistCompletionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await checklistService.toggleChecklistCompletion(input, ctx);
    // Revalidação na ACTION (§3.9 item 1): reconcilia o estado otimista do widget.
    revalidateMonth(ctx.accountId, input.monthId);
  },
});

export const linkChecklistTransactionAction = defineAction({
  schema: linkChecklistTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await checklistService.linkChecklistTransaction(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);
  },
});

export const unlinkChecklistTransactionAction = defineAction({
  schema: unlinkChecklistTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await checklistService.unlinkChecklistTransaction(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);
  },
});

// Só transporte + leitura (picker do widget). Gated a owner/editor — só quem vincula precisa.
export const searchChecklistTransactionsAction = defineAction({
  schema: searchChecklistTransactionsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) =>
    checklistService.searchChecklistTransactions(ctx.accountId, input.monthId, input.query),
});

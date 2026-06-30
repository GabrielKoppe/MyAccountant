"use server";

import { defineAction } from "@/server/api/define-action";
import { requireAccountAccess } from "@/server/auth/session";
import {
  addTagToTransactionSchema,
  bulkAddTagSchema,
  bulkRemoveTagSchema,
  deleteTagSchema,
  removeTagFromTransactionSchema,
  updateTagSchema,
} from "@/lib/schemas/tag";
import * as tagService from "@/server/services/tag-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const addTagToTransactionAction = defineAction({
  schema: addTagToTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) => tagService.addTagToTransaction(input, ctx),
});

export const removeTagFromTransactionAction = defineAction({
  schema: removeTagFromTransactionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) => tagService.removeTagFromTransaction(input, ctx),
});

export const bulkAddTagAction = defineAction({
  schema: bulkAddTagSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) => tagService.bulkAddTag(input, ctx),
});

export const bulkRemoveTagAction = defineAction({
  schema: bulkRemoveTagSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) => tagService.bulkRemoveTag(input, ctx),
});

export const updateTagAction = defineAction({
  schema: updateTagSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) => tagService.updateTag(input, ctx),
});

export const deleteTagAction = defineAction({
  schema: deleteTagSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) => tagService.deleteTag(input, ctx),
});

/** Listagem de tags — disponível para todos os papéis (incluindo viewer). */
export async function listTagsAction(accountId: string) {
  await requireAccountAccess(accountId);
  return tagService.listTags(accountId);
}

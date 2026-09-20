"use server";

import { z } from "zod";

import {
  addTemplateItemSchema,
  applyTemplateSchema,
  createTemplateFromTableSchema,
  createTemplateManualSchema,
  deleteTemplateItemSchema,
  deleteTemplateSchema,
  importTemplateItemsFromTableSchema,
  updateTemplateItemSchema,
  updateTemplateSchema,
} from "@/lib/schemas/table-template";
import { defineAction } from "@/server/api/define-action";
import { revalidateMonth, revalidateTableTemplates } from "@/server/api/revalidate";
import * as svc from "@/server/services/table-template-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const listTemplatesAction = defineAction({
  schema: z.object({}),
  handler: async (_input, ctx) => svc.listTemplates(ctx.accountId),
});

export const createFromTableAction = defineAction({
  schema: createTemplateFromTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await svc.createFromTable(input, ctx);
    revalidateTableTemplates(ctx.accountId);
    return result;
  },
});

export const createTemplateManualAction = defineAction({
  schema: createTemplateManualSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await svc.createManual(input, ctx);
    revalidateTableTemplates(ctx.accountId);
    return result;
  },
});

export const updateTemplateAction = defineAction({
  schema: updateTemplateSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await svc.updateTemplate(input, ctx);
    revalidateTableTemplates(ctx.accountId);
    return result;
  },
});

export const deleteTemplateAction = defineAction({
  schema: deleteTemplateSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.deleteTemplate(input, ctx);
    revalidateTableTemplates(ctx.accountId);
  },
});

export const addTemplateItemAction = defineAction({
  schema: addTemplateItemSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => svc.addItem(input, ctx),
});

export const updateTemplateItemAction = defineAction({
  schema: updateTemplateItemSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => svc.updateItem(input, ctx),
});

export const deleteTemplateItemAction = defineAction({
  schema: deleteTemplateItemSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => svc.deleteItem(input, ctx),
});

// Spec 69 §2.2 / P7 — "Importar de um mês". `revalidateTableTemplates` porque a
// contagem de itens do modelo aparece na lista mestre e no rótulo da aba.
export const importTemplateItemsFromTableAction = defineAction({
  schema: importTemplateItemsFromTableSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await svc.importItemsFromTable(input, ctx);
    revalidateTableTemplates(ctx.accountId);
    return result;
  },
});

export const applyTemplateAction = defineAction({
  schema: applyTemplateSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await svc.applyTemplate(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);
    return result;
  },
});

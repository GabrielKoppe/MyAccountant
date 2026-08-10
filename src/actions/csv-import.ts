"use server";

import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import { revalidateCsvTemplates, revalidateMonth } from "@/server/api/revalidate";
import { csvImportService } from "@/server/services/csv-import-service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  deleteTemplateSchema,
  executeImportSchema,
} from "@/lib/schemas/csv-import";

export const listTemplatesAction = defineAction({
  schema: z.object({}),
  handler: async (_input, ctx) => {
    return csvImportService.listTemplates(ctx.accountId);
  },
});

export const createTemplateAction = defineAction({
  schema: createTemplateSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const result = await csvImportService.createTemplate(input, ctx);
    revalidateCsvTemplates(ctx.accountId);
    return result;
  },
});

export const updateTemplateAction = defineAction({
  schema: updateTemplateSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const result = await csvImportService.updateTemplate(input, ctx);
    revalidateCsvTemplates(ctx.accountId);
    return result;
  },
});

export const deleteTemplateAction = defineAction({
  schema: deleteTemplateSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    await csvImportService.deleteTemplate(input.templateId, ctx);
    revalidateCsvTemplates(ctx.accountId);
  },
});

export const executeImportAction = defineAction({
  schema: executeImportSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const result = await csvImportService.executeImport(input, ctx);
    revalidateMonth(ctx.accountId, input.monthId);
    // `saveTemplateAs` faz um upsert de `CsvTemplate` dentro do import — sem isto,
    // um template criado pelo fluxo de importação não aparece na contagem do hub.
    if (input.saveTemplateAs) revalidateCsvTemplates(ctx.accountId);
    return result;
  },
});

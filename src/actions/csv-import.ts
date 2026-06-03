"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
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
    return csvImportService.createTemplate(input, ctx);
  },
});

export const updateTemplateAction = defineAction({
  schema: updateTemplateSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    return csvImportService.updateTemplate(input, ctx);
  },
});

export const deleteTemplateAction = defineAction({
  schema: deleteTemplateSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    await csvImportService.deleteTemplate(input.templateId, ctx);
  },
});

export const executeImportAction = defineAction({
  schema: executeImportSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const result = await csvImportService.executeImport(input, ctx);
    revalidatePath(`/${ctx.accountId}/months/${input.monthId}`);
    return result;
  },
});

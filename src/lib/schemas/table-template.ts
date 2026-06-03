import { z } from "zod";

import { investmentTypeSchema } from "./transaction";

// Campos de um item de modelo (equivale a uma transação sem data completa)
const templateItemFields = z.object({
  day: z.number().int().min(1).max(31),
  amountCents: z.coerce.bigint(),
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isPending: z.boolean().default(false),
  categoryId: z.string().cuid().nullable().optional(),
  subcategoryId: z.string().cuid().nullable().optional(),
  institutionId: z.string().cuid().nullable().optional(),
  responsibleUserId: z.string().cuid().nullable().optional(),
  cardInstallment: z.string().regex(/^\d+\/\d+$/, "Formato: 3/12").optional().nullable(),
  investmentType: investmentTypeSchema,
});

export const createTemplateFromTableSchema = z.object({
  tableId: z.string().cuid(),
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
});

export const createTemplateManualSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  description: z.string().max(200).optional(),
  tableTypeId: z.string().cuid().nullable().optional(),
  countInMonth: z.boolean().default(true),
});

export const updateTemplateSchema = z.object({
  templateId: z.string().cuid(),
  name: z.string().min(1).max(80).trim().optional(),
  description: z.string().max(200).optional().nullable(),
  tableTypeId: z.string().cuid().nullable().optional(),
  countInMonth: z.boolean().optional(),
});

export const deleteTemplateSchema = z.object({
  templateId: z.string().cuid(),
});

export const addTemplateItemSchema = templateItemFields.extend({
  templateId: z.string().cuid(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateTemplateItemSchema = templateItemFields.partial().extend({
  itemId: z.string().cuid(),
});

export const deleteTemplateItemSchema = z.object({
  itemId: z.string().cuid(),
});

export const applyTemplateSchema = z.object({
  templateId: z.string().cuid(),
  monthId: z.string().cuid(),
  sectionId: z.string().cuid(),
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  tableTypeId: z.string().cuid().optional(),
  countInMonth: z.boolean().optional(),
});

export type CreateTemplateFromTableInput = z.infer<typeof createTemplateFromTableSchema>;
export type CreateTemplateManualInput = z.input<typeof createTemplateManualSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;
export type AddTemplateItemInput = z.input<typeof addTemplateItemSchema>;
export type UpdateTemplateItemInput = z.infer<typeof updateTemplateItemSchema>;
export type DeleteTemplateItemInput = z.infer<typeof deleteTemplateItemSchema>;
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

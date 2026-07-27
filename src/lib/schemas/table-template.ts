import { z } from "zod";

import { partyIdSchema } from "./responsible-party";
import { cuidSchema } from "./shared";
import { investmentTypeSchema } from "./transaction";

// Campos de um item de modelo (equivale a uma transação sem data completa)
const templateItemFields = z.object({
  day: z.number().int().min(1).max(31),
  amountCents: z.coerce.bigint(),
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isPending: z.boolean().default(false),
  categoryId: cuidSchema.nullable().optional(),
  subcategoryId: cuidSchema.nullable().optional(),
  institutionId: cuidSchema.nullable().optional(),
  responsiblePartyId: partyIdSchema.nullable().optional(),
  cardInstallment: z
    .string()
    .regex(/^\d+\/\d+$/, "Formato: 3/12")
    .optional()
    .nullable(),
  investmentType: investmentTypeSchema,
});

export const createTemplateFromTableSchema = z.object({
  tableId: cuidSchema,
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
});

export const createTemplateManualSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  description: z.string().max(200).optional(),
  tableTypeId: cuidSchema.nullable().optional(),
  countInMonth: z.boolean().default(true),
});

export const updateTemplateSchema = z.object({
  templateId: cuidSchema,
  name: z.string().min(1).max(80).trim().optional(),
  description: z.string().max(200).optional().nullable(),
  tableTypeId: cuidSchema.nullable().optional(),
  countInMonth: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  autoSectionId: cuidSchema.nullable().optional(),
  autoTableTypeId: cuidSchema.nullable().optional(),
});

export const deleteTemplateSchema = z.object({
  templateId: cuidSchema,
});

export const addTemplateItemSchema = templateItemFields.extend({
  templateId: cuidSchema,
  displayOrder: z.number().int().min(0).optional(),
});

export const updateTemplateItemSchema = templateItemFields.partial().extend({
  itemId: cuidSchema,
});

export const deleteTemplateItemSchema = z.object({
  itemId: cuidSchema,
});

export const applyTemplateSchema = z.object({
  templateId: cuidSchema,
  monthId: cuidSchema,
  sectionId: cuidSchema,
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  tableTypeId: cuidSchema.optional(),
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

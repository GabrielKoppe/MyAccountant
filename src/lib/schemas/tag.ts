import { z } from "zod";

const TAG_NAME_REGEX = /^[\w\s\-àáâãéêíóôõúç]+$/u;

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Nome obrigatório")
    .max(30, "Máximo 30 caracteres")
    .regex(TAG_NAME_REGEX, "Caracteres especiais não permitidos")
    .trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .optional(),
});

export const addTagToTransactionSchema = z.object({
  transactionId: z.string().cuid("ID inválido"),
  tagName: z
    .string()
    .min(1, "Nome obrigatório")
    .max(30, "Máximo 30 caracteres")
    .regex(TAG_NAME_REGEX, "Caracteres especiais não permitidos")
    .trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .optional(),
});

export const removeTagFromTransactionSchema = z.object({
  transactionId: z.string().cuid("ID inválido"),
  tagId: z.string().cuid("ID inválido"),
});

export const bulkAddTagSchema = z.object({
  transactionIds: z.array(z.string().cuid()).min(1),
  tagName: z.string().min(1).max(30).regex(TAG_NAME_REGEX).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const bulkRemoveTagSchema = z.object({
  transactionIds: z.array(z.string().cuid()).min(1),
  tagId: z.string().cuid("ID inválido"),
});

export const updateTagSchema = z.object({
  tagId: z.string().cuid("ID inválido"),
  name: z.string().min(1).max(30).regex(TAG_NAME_REGEX).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export const deleteTagSchema = z.object({
  tagId: z.string().cuid("ID inválido"),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type AddTagToTransactionInput = z.infer<typeof addTagToTransactionSchema>;
export type RemoveTagFromTransactionInput = z.infer<typeof removeTagFromTransactionSchema>;
export type BulkAddTagInput = z.infer<typeof bulkAddTagSchema>;
export type BulkRemoveTagInput = z.infer<typeof bulkRemoveTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type DeleteTagInput = z.infer<typeof deleteTagSchema>;

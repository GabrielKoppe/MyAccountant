import { z } from "zod";

export const baseTransactionSchema = z.object({
  occurredOn: z.coerce.date(),
  amountCents: z.coerce.bigint(),
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isPending: z.boolean(),
  isFavorite: z.boolean(),
  categoryId: z.string().cuid("ID inválido").nullable().optional(),
  subcategoryId: z.string().cuid("ID inválido").nullable().optional(),
  institutionId: z.string().cuid("ID inválido").nullable().optional(),
  institutionText: z.string().max(80).optional().nullable(),
  responsibleUserId: z.string().cuid("ID inválido").nullable().optional(),
  cardInstallment: z
    .string()
    .regex(/^\d+\/\d+$/, "Formato: 3/12")
    .optional()
    .nullable(),
  investmentType: z.string().max(40).optional().nullable(),
});

export const createTransactionSchema = baseTransactionSchema.extend({
  tableId: z.string().cuid("ID inválido"),
});

export const updateTransactionSchema = baseTransactionSchema.partial().extend({
  transactionId: z.string().cuid("ID inválido"),
});

export const deleteTransactionSchema = z.object({
  transactionId: z.string().cuid("ID inválido"),
});

export const duplicateTransactionSchema = z.object({
  transactionId: z.string().cuid("ID inválido"),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().cuid("ID inválido")).min(1),
});

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().cuid("ID inválido")).min(1),
  patch: z.object({
    isPending: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    categoryId: z.string().cuid().nullable().optional(),
    institutionId: z.string().cuid().nullable().optional(),
  }),
});

export const moveTransactionsSchema = z.object({
  ids: z.array(z.string().cuid("ID inválido")).min(1),
  sourceMonthId: z.string().cuid("ID inválido"),
  destination: z.discriminatedUnion("type", [
    // Mover para tabela já existente
    z.object({ type: z.literal("existing"), tableId: z.string().cuid("ID inválido") }),
    // Criar nova tabela e mover para ela (não cria Seção nem Mês)
    z.object({
      type: z.literal("new"),
      monthId: z.string().cuid("ID inválido"),
      sectionId: z.string().cuid("ID inválido"),
      tableTypeId: z.string().cuid("ID inválido"),
      name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
      countInMonth: z.boolean(),
    }),
  ]),
});

export const listTablesForMoveSchema = z.object({});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type DeleteTransactionInput = z.infer<typeof deleteTransactionSchema>;
export type DuplicateTransactionInput = z.infer<typeof duplicateTransactionSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type MoveTransactionsInput = z.infer<typeof moveTransactionsSchema>;
export type ListTablesForMoveInput = z.infer<typeof listTablesForMoveSchema>;

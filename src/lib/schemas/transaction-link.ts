import { z } from "zod";
import { TransactionLinkType } from "@prisma/client";
import { cuidSchema } from "./shared";

export { TransactionLinkType };

export const createTransactionLinkSchema = z.object({
  sourceId: cuidSchema,
  targetId: cuidSchema,
  type: z.nativeEnum(TransactionLinkType),
  notes: z.string().max(500).optional().nullable(),
});

export const deleteTransactionLinkSchema = z.object({
  linkId: cuidSchema,
});

export const listLinksForTransactionSchema = z.object({
  transactionId: cuidSchema,
});

export const searchTransactionsForLinkSchema = z.object({
  query: z.string().max(100),
  excludeTransactionId: cuidSchema.optional(),
  tableId: cuidSchema.optional(),
});

export const getMonthsForLinkSchema = z.object({});

export const getSectionsTablesSchema = z.object({
  monthId: cuidSchema,
});

export type CreateTransactionLinkInput = z.infer<typeof createTransactionLinkSchema>;
export type DeleteTransactionLinkInput = z.infer<typeof deleteTransactionLinkSchema>;
export type ListLinksInput = z.infer<typeof listLinksForTransactionSchema>;
export type SearchTransactionsForLinkInput = z.infer<typeof searchTransactionsForLinkSchema>;

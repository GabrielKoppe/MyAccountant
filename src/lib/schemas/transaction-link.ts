import { z } from "zod";
import { TransactionLinkType } from "@prisma/client";

export { TransactionLinkType };

export const createTransactionLinkSchema = z.object({
  sourceId: z.string().cuid("ID inválido"),
  targetId: z.string().cuid("ID inválido"),
  type: z.nativeEnum(TransactionLinkType),
  notes: z.string().max(500).optional().nullable(),
});

export const deleteTransactionLinkSchema = z.object({
  linkId: z.string().cuid("ID inválido"),
});

export const listLinksForTransactionSchema = z.object({
  transactionId: z.string().cuid("ID inválido"),
});

export const searchTransactionsForLinkSchema = z.object({
  query: z.string().max(100),
  excludeTransactionId: z.string().cuid().optional(),
  tableId: z.string().cuid().optional(),
});

export const getMonthsForLinkSchema = z.object({});

export const getSectionsTablesSchema = z.object({
  monthId: z.string().cuid(),
});

export type CreateTransactionLinkInput = z.infer<typeof createTransactionLinkSchema>;
export type DeleteTransactionLinkInput = z.infer<typeof deleteTransactionLinkSchema>;
export type ListLinksInput = z.infer<typeof listLinksForTransactionSchema>;
export type SearchTransactionsForLinkInput = z.infer<typeof searchTransactionsForLinkSchema>;

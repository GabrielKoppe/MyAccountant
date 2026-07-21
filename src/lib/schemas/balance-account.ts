import { z } from "zod";

import { cuidSchema, dateSchema, amountCentsSchema } from "./shared";

export const balanceAccountKindSchema = z.enum(["asset", "liability"]);
const nameSchema = z.string().min(1, "Nome obrigatório").max(80).trim();
const notFuture = (d: Date) => d <= new Date();
const futureMsg = "Data não pode ser futura";

export const createBalanceAccountSchema = z.object({
  kind: balanceAccountKindSchema, // kind só na criação (DD-05)
  name: nameSchema,
  institutionId: cuidSchema.optional().nullable(),
});

export const updateBalanceAccountSchema = z.object({
  balanceAccountId: cuidSchema,
  name: nameSchema,
  institutionId: cuidSchema.optional().nullable(), // SEM kind (imutável)
});

export const archiveBalanceAccountSchema = z.object({
  balanceAccountId: cuidSchema,
  archived: z.boolean(), // true=arquivar, false=desarquivar
});

export const deleteBalanceAccountSchema = z.object({ balanceAccountId: cuidSchema });

export const upsertBalanceSnapshotSchema = z.object({
  balanceAccountId: cuidSchema,
  balanceCents: amountCentsSchema, // aceita negativo (não usar .positive())
  capturedOn: dateSchema.refine(notFuture, futureMsg),
});

export const upsertBalanceSnapshotsSchema = z.object({
  // lote "Atualizar saldos"
  capturedOn: dateSchema.refine(notFuture, futureMsg),
  entries: z.array(z.object({ balanceAccountId: cuidSchema, balanceCents: amountCentsSchema })).min(1),
});

export type CreateBalanceAccountInput = z.infer<typeof createBalanceAccountSchema>;
export type UpdateBalanceAccountInput = z.infer<typeof updateBalanceAccountSchema>;
export type ArchiveBalanceAccountInput = z.infer<typeof archiveBalanceAccountSchema>;
export type DeleteBalanceAccountInput = z.infer<typeof deleteBalanceAccountSchema>;
export type UpsertBalanceSnapshotInput = z.infer<typeof upsertBalanceSnapshotSchema>;
export type UpsertBalanceSnapshotsInput = z.infer<typeof upsertBalanceSnapshotsSchema>;

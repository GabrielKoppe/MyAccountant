import { z } from "zod";
import { cuidSchema } from "./shared";

export const createInstallmentGroupSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória").max(200),
  /** Valor total da compra em centavos */
  totalCents: z.coerce.bigint().positive("Valor total deve ser positivo"),
  /** Número de parcelas (2–360) */
  installmentCount: z.coerce
    .number()
    .int()
    .min(2, "Mínimo 2 parcelas")
    .max(360, "Máximo 360 parcelas"),
  /** Entrada opcional (parcela 1 diferente) em centavos */
  downPaymentCents: z.coerce.bigint().positive().optional(),
  /** Data da 1ª parcela */
  startDate: z.coerce.date({ message: "Data inválida" }),
  /** Tabela onde a 1ª parcela será criada — seção e tipo de tabela são derivados */
  tableId: cuidSchema,
});

export type CreateInstallmentGroupInput = z.infer<typeof createInstallmentGroupSchema>;

export const settleInstallmentGroupSchema = z.object({
  installmentGroupId: cuidSchema,
  mode: z.enum(["individual", "consolidated"]),
  tableId: cuidSchema,
  /** Quantas parcelas pendentes (ordenadas por número) quitar agora */
  count: z.coerce.number().int().min(1, "Selecione ao menos 1 parcela"),
});

export type SettleInstallmentGroupInput = z.infer<typeof settleInstallmentGroupSchema>;

export const undoInstallmentGroupSchema = z.object({
  installmentGroupId: cuidSchema,
});

export type UndoInstallmentGroupInput = z.infer<typeof undoInstallmentGroupSchema>;

/** Spec 73 §2.5 — marcar/desmarcar parcela prevista como paga fora do app. */
export const setPendingInstallmentSettledSchema = z.object({
  pendingInstallmentId: cuidSchema,
  settled: z.boolean(),
});

export type SetPendingInstallmentSettledInput = z.infer<typeof setPendingInstallmentSettledSchema>;

/** Spec 73 §2.4 — criação automática das parcelas futuras ao abrir um mês novo. */
export const setInstallmentGroupAutoCreateSchema = z.object({
  installmentGroupId: cuidSchema,
  autoCreateOnNewMonth: z.boolean(),
});

export type SetInstallmentGroupAutoCreateInput = z.infer<
  typeof setInstallmentGroupAutoCreateSchema
>;

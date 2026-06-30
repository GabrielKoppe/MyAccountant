import { z } from "zod";

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
  tableId: z.string().cuid("ID de tabela inválido"),
});

export type CreateInstallmentGroupInput = z.infer<typeof createInstallmentGroupSchema>;

export const settleInstallmentGroupSchema = z.object({
  installmentGroupId: z.string().cuid("ID inválido"),
  mode: z.enum(["individual", "consolidated"]),
  tableId: z.string().cuid("ID de tabela inválido"),
  /** Quantas parcelas pendentes (ordenadas por número) quitar agora */
  count: z.coerce.number().int().min(1, "Selecione ao menos 1 parcela"),
});

export type SettleInstallmentGroupInput = z.infer<typeof settleInstallmentGroupSchema>;

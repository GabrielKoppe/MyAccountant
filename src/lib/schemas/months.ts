import { z } from "zod";

import { cuidSchema } from "./shared";

const yearMonthShape = {
  year: z.number().int().min(2000).max(2400),
  month: z.number().int().min(1).max(12),
};

export const createMonthSchema = z.object({
  ...yearMonthShape,
  /**
   * Escolha do passo "Automações" (spec 73 §2.4). **Ausente = comportamento
   * automático** (todos os modelos `autoApply` + pendências de grupos com
   * `autoCreateOnNewMonth`), o que preserva a rota REST e chamadas antigas.
   */
  selection: z
    .object({
      templateIds: z.array(cuidSchema).max(200),
      pendingInstallmentIds: z.array(cuidSchema).max(500),
    })
    .optional(),
});

/** Dry-run do que a criação do mês vai lançar (spec 73 §2.4). */
export const previewMonthAutomationsSchema = z.object({ ...yearMonthShape });

export const deleteMonthSchema = z.object({
  monthId: cuidSchema,
});

export type AutoApplyResult = {
  templateName: string;
  success: boolean;
  error?: string;
};

export type CreateMonthInput = z.infer<typeof createMonthSchema>;
export type PreviewMonthAutomationsInput = z.infer<typeof previewMonthAutomationsSchema>;
export type DeleteMonthInput = z.infer<typeof deleteMonthSchema>;

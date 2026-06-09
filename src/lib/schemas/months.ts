import { z } from "zod";

export const createMonthSchema = z.object({
  year: z.number().int().min(2000).max(2400),
  month: z.number().int().min(1).max(12),
});

export const deleteMonthSchema = z.object({
  monthId: z.string().cuid("ID inválido"),
});

export type AutoApplyResult = {
  templateName: string;
  success: boolean;
  error?: string;
};

export type CreateMonthInput = z.infer<typeof createMonthSchema>;
export type DeleteMonthInput = z.infer<typeof deleteMonthSchema>;

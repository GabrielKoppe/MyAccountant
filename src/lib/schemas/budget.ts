import { z } from "zod";

const optionalId = z.string().cuid("ID inválido").optional();

export const createBudgetSchema = z
  .object({
    name: z.string().max(80).trim().nullable().optional(),
    sectionId: optionalId,
    categoryId: optionalId,
    memberUserId: optionalId,
    institutionId: optionalId,
    tableTypeId: optionalId,
    amountCents: z.coerce.bigint().positive("Valor deve ser positivo"),
    alertThresholdPercent: z.number().int().min(1).max(99),
    isRecurring: z.boolean(),
    showInSummary: z.boolean(),
    year: z.number().int().min(2000).max(2100).optional().nullable(),
    month: z.number().int().min(1).max(12).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasDimension =
      data.sectionId ||
      data.categoryId ||
      data.memberUserId ||
      data.institutionId ||
      data.tableTypeId;
    if (!hasDimension) {
      ctx.addIssue({
        code: "custom",
        message:
          "Selecione pelo menos uma dimensão (seção, categoria, membro, instituição ou tipo de tabela)",
        path: ["sectionId"],
      });
    }

    if (data.sectionId && data.categoryId) {
      ctx.addIssue({
        code: "custom",
        message: "Seção e categoria não podem ser combinadas",
        path: ["categoryId"],
      });
    }
    if (data.sectionId && data.tableTypeId) {
      ctx.addIssue({
        code: "custom",
        message: "Seção e tipo de tabela não podem ser combinados",
        path: ["tableTypeId"],
      });
    }

    if (data.isRecurring && (data.year || data.month)) {
      ctx.addIssue({
        code: "custom",
        message: "Metas recorrentes não devem ter mês/ano específico",
        path: ["year"],
      });
    }
    if (!data.isRecurring && (!data.year || !data.month)) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o mês e ano para metas específicas",
        path: ["year"],
      });
    }
  });

export const updateBudgetSchema = createBudgetSchema.and(
  z.object({ budgetId: z.string().cuid("ID inválido") }),
);

export const deleteBudgetSchema = z.object({
  budgetId: z.string().cuid("ID inválido"),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type DeleteBudgetInput = z.infer<typeof deleteBudgetSchema>;

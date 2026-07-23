import { z } from "zod";

import { m } from "@/lib/messages";

const optionalId = z.string().cuid("ID inválido").optional();

// Mensagens de erro vêm de `m.budgets.form.errors.*` (CLAUDE.md §5.10 — mensagens de UI
// centralizadas, sem exceção pra Zod): este `.superRefine`/os `.min`/`.max` abaixo são a
// ÚNICA fonte de validação (client via zodResolver em BudgetFormDialog.tsx + server);
// nada disso é reimplementado no form.
export const createBudgetSchema = z
  .object({
    name: z.string().max(80).trim().nullable().optional(),
    sectionId: optionalId,
    categoryId: optionalId,
    memberUserId: optionalId,
    institutionId: optionalId,
    tableTypeId: optionalId,
    amountCents: z.coerce.bigint().positive(m.budgets.form.errors.amountPositive),
    alertThresholdPercent: z
      .number()
      .int()
      .min(1, m.budgets.form.errors.thresholdRange)
      .max(99, m.budgets.form.errors.thresholdRange),
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
        message: m.budgets.form.errors.noDimension,
        path: ["sectionId"],
      });
    }

    if (data.sectionId && data.categoryId) {
      ctx.addIssue({
        code: "custom",
        message: m.budgets.form.errors.sectionCategoryConflict,
        path: ["categoryId"],
      });
    }
    if (data.sectionId && data.tableTypeId) {
      ctx.addIssue({
        code: "custom",
        message: m.budgets.form.errors.sectionTableTypeConflict,
        path: ["tableTypeId"],
      });
    }

    if (data.isRecurring && (data.year || data.month)) {
      ctx.addIssue({
        code: "custom",
        message: m.budgets.form.errors.recurringWithPeriod,
        path: ["year"],
      });
    }
    if (!data.isRecurring && (!data.year || !data.month)) {
      ctx.addIssue({
        code: "custom",
        message: m.budgets.form.errors.yearMonthRequired,
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

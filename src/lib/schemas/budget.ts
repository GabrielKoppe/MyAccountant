import { z } from "zod";

import { m } from "@/lib/messages";

import { cuidSchema } from "./shared";

// ─── Dimensões multi-valor (Spec 25) ────────────────────────────────────────
// Cada dimensão do orçamento (seção/categoria/membro/instituição/tipo de tabela)
// virou um ARRAY de ids. O helper `dimIds` normaliza a entrada ANTES de validar:
//   - `undefined`/não-array (form sem seleção)                    → []
//   - remove "" (opção "Nenhum" de um <Select>) e valores falsy   → filter(Boolean)
//   - remove duplicados                                            → new Set
//   - default([]) garante array mesmo quando a chave está ausente
// Só então cada elemento restante é validado como cuid (`cuidSchema`). Isto é a
// fonte única de validação (CLAUDE.md §5.4): vale para o client (zodResolver em
// BudgetFormDialog) e para o server (defineAction), sem regra duplicada no form.
const dimIds = z.preprocess(
  (v) => (Array.isArray(v) ? [...new Set(v.filter(Boolean))] : []),
  z.array(cuidSchema).default([]),
);

// Mensagens de erro vêm de `m.budgets.form.errors.*` (CLAUDE.md §5.10 — mensagens de UI
// centralizadas, sem exceção pra Zod): este `.superRefine`/os `.min`/`.max` abaixo são a
// ÚNICA fonte de validação (client via zodResolver em BudgetFormDialog.tsx + server).
export const createBudgetSchema = z
  .object({
    name: z.string().max(80).trim().nullable().optional(),
    sectionIds: dimIds,
    categoryIds: dimIds,
    memberUserIds: dimIds,
    institutionIds: dimIds,
    tableTypeIds: dimIds,
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
      data.sectionIds.length > 0 ||
      data.categoryIds.length > 0 ||
      data.memberUserIds.length > 0 ||
      data.institutionIds.length > 0 ||
      data.tableTypeIds.length > 0;
    if (!hasDimension) {
      ctx.addIssue({
        code: "custom",
        message: m.budgets.form.errors.noDimension,
        path: ["sectionIds"],
      });
    }

    // Seção e categoria são hierarquicamente sobrepostas (categoria vive dentro de
    // seções) — combiná-las produziria uma interseção quase sempre vazia. Idem
    // seção × tipo de tabela. Mantido da regra escalar, agora sobre "tem ao menos 1".
    if (data.sectionIds.length > 0 && data.categoryIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: m.budgets.form.errors.sectionCategoryConflict,
        path: ["categoryIds"],
      });
    }
    if (data.sectionIds.length > 0 && data.tableTypeIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: m.budgets.form.errors.sectionTableTypeConflict,
        path: ["tableTypeIds"],
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

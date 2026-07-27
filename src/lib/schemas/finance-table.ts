import { z } from "zod";

import { cuidSchema } from "./shared";

export const createFinanceTableSchema = z
  .object({
    monthId: cuidSchema,
    sectionId: cuidSchema,
    name: z.string().min(1, "Nome obrigatório").max(80).trim(),
    tableTypeId: cuidSchema,
    sourceMethod: z.enum(["empty", "copy", "template"]),
    countInMonth: z.boolean(),
    // Campos condicionais para source method "copy"
    sourceTableId: cuidSchema.optional(),
    copyOptions: z
      .object({
        includeTransactions: z.boolean(),
        updateDates: z.boolean(),
        markAsPending: z.boolean(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceMethod === "copy" && !data.sourceTableId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione a tabela de origem",
        path: ["sourceTableId"],
      });
    }
  });

export const updateFinanceTableSchema = z.object({
  tableId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(80).trim().optional(),
  countInMonth: z.boolean().optional(),
  groupByDate: z.boolean().optional(),
  tableTypeId: cuidSchema.optional(),
});

export const deleteFinanceTableSchema = z.object({
  tableId: cuidSchema,
});

export const reorderFinanceTablesSchema = z.object({
  monthId: cuidSchema,
  sectionId: cuidSchema,
  orderedIds: z.array(cuidSchema).min(1),
});

export type CreateFinanceTableInput = z.infer<typeof createFinanceTableSchema>;
export type UpdateFinanceTableInput = z.infer<typeof updateFinanceTableSchema>;
export type DeleteFinanceTableInput = z.infer<typeof deleteFinanceTableSchema>;
export type ReorderFinanceTablesInput = z.infer<typeof reorderFinanceTablesSchema>;

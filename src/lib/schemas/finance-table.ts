import { z } from "zod";

export const createFinanceTableSchema = z
  .object({
    monthId: z.string().cuid("ID inválido"),
    sectionId: z.string().cuid("ID inválido"),
    name: z.string().min(1, "Nome obrigatório").max(80).trim(),
    tableTypeId: z.string().cuid("ID inválido"),
    sourceMethod: z.enum(["empty", "copy", "template"]),
    countInMonth: z.boolean(),
    // Campos condicionais para source method "copy"
    sourceTableId: z.string().cuid("ID inválido").optional(),
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
  tableId: z.string().cuid("ID inválido"),
  name: z.string().min(1, "Nome obrigatório").max(80).trim().optional(),
  countInMonth: z.boolean().optional(),
  groupByDate: z.boolean().optional(),
  tableTypeId: z.string().cuid("ID inválido").optional(),
});

export const deleteFinanceTableSchema = z.object({
  tableId: z.string().cuid("ID inválido"),
});

export const reorderFinanceTablesSchema = z.object({
  monthId: z.string().cuid("ID inválido"),
  sectionId: z.string().cuid("ID inválido"),
  orderedIds: z.array(z.string().cuid("ID inválido")).min(1),
});

export type CreateFinanceTableInput = z.infer<typeof createFinanceTableSchema>;
export type UpdateFinanceTableInput = z.infer<typeof updateFinanceTableSchema>;
export type DeleteFinanceTableInput = z.infer<typeof deleteFinanceTableSchema>;
export type ReorderFinanceTablesInput = z.infer<typeof reorderFinanceTablesSchema>;

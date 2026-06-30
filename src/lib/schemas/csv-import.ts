import { z } from "zod";

export const importMappingSchema = z.object({
  columns: z.object({
    date: z.string().min(1, "Mapeamento de data é obrigatório"),
    amount: z.string().min(1, "Mapeamento de valor é obrigatório"),
    description: z.string().optional(),
    notes: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    institution: z.string().optional(),
    cardInstallment: z.string().optional(),
    investmentType: z.string().optional(),
    responsibleUser: z.string().optional(),
    fxAmount: z.string().optional(),
    fxRate: z.string().optional(),
    fxCurrency: z.string().optional(),
  }),
  // Mapeia texto da coluna → userId do membro (ex: "GABRIEL KOPPE" → "clxxx...")
  responsibleUserMappings: z
    .array(z.object({ text: z.string().min(1), userId: z.string().cuid() }))
    .default([]),
  dateFormat: z.string().default("DD/MM/YYYY"),
  amountFormat: z.enum(["brl", "us"]).default("brl"),
  amountSign: z.enum(["raw", "invert", "abs"]).default("raw"),
  csvDelimiter: z.string().default(","),
  hasHeader: z.boolean().default(true),
  skipRows: z.number().int().min(0).default(0),
  ignoreEmptyRows: z.boolean().default(true),
  ignoreRowsWhere: z
    .array(z.object({ column: z.string().min(1), contains: z.string().min(1) }))
    .default([]),
  defaultCategoryId: z.string().cuid().nullable().default(null),
  defaultInstitutionId: z.string().cuid().nullable().default(null),
  onCategoryNotFound: z.enum(["ignore", "create", "fail"]).default("create"),
  onSubcategoryNotFound: z.enum(["ignore", "create"]).default("create"),
  onInstitutionNotFound: z.enum(["ignore", "create", "fail"]).default("ignore"),
  /** Moeda padrão para transações estrangeiras quando não há coluna de moeda (ex: "USD") */
  fxCurrencyDefault: z.string().max(3).default(""),
});

export type ImportMapping = z.infer<typeof importMappingSchema>;

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  mapping: importMappingSchema,
});

export const updateTemplateSchema = z.object({
  templateId: z.string().cuid(),
  name: z.string().min(1).max(80).optional(),
  mapping: importMappingSchema.optional(),
});

export const deleteTemplateSchema = z.object({
  templateId: z.string().cuid(),
});

export const executeImportSchema = z.object({
  monthId: z.string().cuid(),
  sectionId: z.string().cuid(),
  tableTypeId: z.string().cuid(),
  tableName: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  countInMonth: z.boolean().default(true),
  mapping: importMappingSchema,
  saveTemplateAs: z.string().min(1).max(80).optional(),
  rows: z.array(z.record(z.string(), z.string())).max(5000),
  fileType: z.enum(["csv", "xlsx"]).default("csv"),
  /** Sugestões de parcelamento confirmadas pelo usuário na tela de preview */
  acceptedInstallments: z
    .array(
      z.object({
        groupDescription: z.string().max(200),
        installmentCount: z.number().int().min(2).max(360),
        lines: z.array(
          z.object({
            rowIndex: z.number().int().min(0),
            installmentNumber: z.number().int().min(1),
          }),
        ),
        totalAmountCents: z.coerce.bigint().positive(),
      }),
    )
    .optional()
    .default([]),
});

// z.input<> includes optional fields from .default() — matches what defineAction infers for TInput
export type CreateTemplateInput = z.input<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.input<typeof updateTemplateSchema>;
export type DeleteTemplateInput = z.input<typeof deleteTemplateSchema>;
export type ExecuteImportInput = z.input<typeof executeImportSchema>;

export const DEFAULT_MAPPING: ImportMapping = {
  columns: { date: "", amount: "" }, // optional fields default to undefined
  dateFormat: "DD/MM/YYYY",
  amountFormat: "brl",
  amountSign: "raw",
  csvDelimiter: ",",
  hasHeader: true,
  skipRows: 0,
  ignoreEmptyRows: true,
  ignoreRowsWhere: [],
  defaultCategoryId: null,
  defaultInstitutionId: null,
  onCategoryNotFound: "create",
  onSubcategoryNotFound: "create",
  onInstitutionNotFound: "ignore",
  fxCurrencyDefault: "",
  responsibleUserMappings: [],
};

export const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/AAAA (ex: 03/01/2026)" },
  { value: "DD/MM/YY", label: "DD/MM/AA (ex: 03/01/26)" },
  { value: "YYYY-MM-DD", label: "AAAA-MM-DD (ex: 2026-01-03)" },
  { value: "MM/DD/YYYY", label: "MM/DD/AAAA — formato US" },
] as const;

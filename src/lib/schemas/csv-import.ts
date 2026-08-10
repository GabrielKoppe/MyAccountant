import { z } from "zod";

import { cuidSchema } from "./shared";

export const importMappingSchema = z
  .object({
    columns: z.object({
      date: z.string().min(1, "Mapeamento de data é obrigatório"),
      // Em amountMode="single" é obrigatório (validado no superRefine abaixo).
      // Em amountMode="creditDebit" fica vazio e o valor vem de amountCredit/amountDebit.
      amount: z.string().default(""),
      // Colunas separadas de entrada/saída (extratos bancários). valorCents = entrada − saída.
      amountCredit: z.string().optional(),
      amountDebit: z.string().optional(),
      description: z.string().optional(),
      // Uma ou mais colunas. Cada célula não-vazia vira uma linha "NomeColuna: valor" na nota.
      // preprocess: aceita template antigo salvo como string única e normaliza para array.
      notes: z.preprocess(
        (v) => (typeof v === "string" ? (v ? [v] : []) : Array.isArray(v) ? v : []),
        z.array(z.string()),
      ),
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
      .array(z.object({ text: z.string().min(1), userId: cuidSchema }))
      .default([]),
    dateFormat: z.string().default("DD/MM/YYYY"),
    amountFormat: z.enum(["brl", "us"]).default("brl"),
    amountSign: z.enum(["raw", "invert", "abs"]).default("raw"),
    // Origem do valor: uma coluna única (com sinal) ou duas colunas (entrada − saída).
    amountMode: z.enum(["single", "creditDebit"]).default("single"),
    csvDelimiter: z.string().default(","),
    // Encoding de leitura do CSV. "auto" tenta UTF-8 e cai p/ Windows-1252 se detectar mojibake.
    encoding: z.enum(["auto", "utf-8", "iso-8859-1", "windows-1252"]).default("auto"),
    hasHeader: z.boolean().default(true),
    skipRows: z.number().int().min(0).default(0),
    ignoreEmptyRows: z.boolean().default(true),
    ignoreRowsWhere: z
      .array(z.object({ column: z.string().min(1), contains: z.string().min(1) }))
      .default([]),
    defaultCategoryId: cuidSchema.nullable().default(null),
    defaultInstitutionId: cuidSchema.nullable().default(null),
    onCategoryNotFound: z.enum(["ignore", "create", "fail"]).default("create"),
    onSubcategoryNotFound: z.enum(["ignore", "create"]).default("create"),
    onInstitutionNotFound: z.enum(["ignore", "create", "fail"]).default("ignore"),
    /** Moeda padrão para transações estrangeiras quando não há coluna de moeda (ex: "USD") */
    fxCurrencyDefault: z.string().max(3).default(""),
  })
  .superRefine((val, ctx) => {
    if (val.amountMode === "single" && !val.columns.amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["columns", "amount"],
        message: "Mapeamento de valor é obrigatório",
      });
    }
    if (val.amountMode === "creditDebit" && !val.columns.amountCredit && !val.columns.amountDebit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["columns", "amountCredit"],
        message: "Mapeie ao menos uma coluna de entrada ou saída",
      });
    }
  });

export type ImportMapping = z.infer<typeof importMappingSchema>;

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  mapping: importMappingSchema,
});

export const updateTemplateSchema = z.object({
  templateId: cuidSchema,
  name: z.string().min(1).max(80).optional(),
  mapping: importMappingSchema.optional(),
});

export const deleteTemplateSchema = z.object({
  templateId: cuidSchema,
});

export const executeImportSchema = z.object({
  monthId: cuidSchema,
  sectionId: cuidSchema,
  tableTypeId: cuidSchema,
  tableName: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  countInMonth: z.boolean().default(true),
  mapping: importMappingSchema,
  /**
   * Template de importação que originou o `mapping` (spec 67 §7.4 / SET-07).
   * Puramente informativo: o servidor NÃO relê o template — o `mapping` inline
   * continua sendo a única fonte da verdade do parse. Serve só para gravar
   * `CsvTemplate.lastUsedAt`. Ausente = importação sem template (fluxo antigo,
   * inalterado). Id de outra account simplesmente não casa no `updateMany`.
   */
  templateId: cuidSchema.optional(),
  saveTemplateAs: z.string().min(1).max(80).optional(),
  rows: z.array(z.record(z.string(), z.string())).max(5000),
  fileType: z.enum(["csv", "xlsx"]).default("csv"),
  /** rowIndexes que o usuário marcou manualmente para ignorar na tela de preview */
  manualIgnoreRows: z.array(z.number().int().min(0)).default([]),
  /** rowIndexes casadas por um apelido que o usuário optou por NÃO aplicar (DD-16) */
  aliasIgnoreRows: z.array(z.number().int().min(0)).default([]),
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
        /**
         * InstallmentGroup existente ao qual vincular esta sugestão (spec 73
         * §2.3). Ausente = criar grupo novo. O service revalida o `accountId`.
         */
        existingGroupId: cuidSchema.optional(),
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
  columns: { date: "", amount: "", notes: [] }, // demais campos opcionais → undefined
  dateFormat: "DD/MM/YYYY",
  amountFormat: "brl",
  amountSign: "raw",
  amountMode: "single",
  csvDelimiter: ",",
  encoding: "auto",
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
  { value: "YYYY/MM/DD", label: "AAAA/MM/DD (ex: 2026/01/03)" },
  { value: "DD-MM-YYYY", label: "DD-MM-AAAA (ex: 03-01-2026)" },
  { value: "DD.MM.YYYY", label: "DD.MM.AAAA (ex: 03.01.2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/AAAA — formato US" },
] as const;

export const CSV_ENCODINGS = [
  { value: "auto", label: "Automático" },
  { value: "utf-8", label: "UTF-8" },
  { value: "iso-8859-1", label: "ISO-8859-1 (Latin-1)" },
  { value: "windows-1252", label: "Windows-1252" },
] as const;

export type CsvEncoding = (typeof CSV_ENCODINGS)[number]["value"];

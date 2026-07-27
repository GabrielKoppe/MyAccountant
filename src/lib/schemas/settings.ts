import { z } from "zod";

import { m } from "@/lib/messages";

import { partyIdSchema } from "./responsible-party";
import { cuidSchema } from "./shared";

// ─── Account General ──────────────────────────────────────────────

export const updateAccountSettingsSchema = z.object({
  accountName: z.string().min(1, "Nome obrigatório").max(80).trim(),
  currency: z.enum(["BRL"]),
  monthStartDay: z.number().int().min(1).max(28),
  defaultResponsiblePartyId: partyIdSchema.nullable().optional(),
  // Default de inversão de sinal ao mover transações entre seções (spec 59)
  invertSignOnMoveByDefault: z.boolean(),
});

export type UpdateAccountSettingsInput = z.infer<typeof updateAccountSettingsSchema>;

// ─── Sections ─────────────────────────────────────────────────────

export const createSectionSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(40).trim(),
  countType: z.enum(["add", "subtract", "ignore", "neutral"]),
  isActive: z.boolean(),
});

export const updateSectionSchema = z.object({
  sectionId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(40).trim(),
  countType: z.enum(["add", "subtract", "ignore", "neutral"]),
  isActive: z.boolean(),
});

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(cuidSchema).min(1),
});

export const deleteSectionSchema = z.object({
  sectionId: cuidSchema,
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;
export type DeleteSectionInput = z.infer<typeof deleteSectionSchema>;

// ─── Categories ───────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
});

export const updateCategorySchema = z.object({
  categoryId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
});

export const deleteCategorySchema = z.object({
  categoryId: cuidSchema,
});

export const createSubcategorySchema = z.object({
  categoryId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
});

export const updateSubcategorySchema = z.object({
  subcategoryId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
});

export const deleteSubcategorySchema = z.object({
  subcategoryId: cuidSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;
export type DeleteSubcategoryInput = z.infer<typeof deleteSubcategorySchema>;

// ─── Institutions ─────────────────────────────────────────────────

export const createInstitutionSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(80).trim(),
});

export const updateInstitutionSchema = z.object({
  institutionId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(80).trim(),
});

export const deleteInstitutionSchema = z.object({
  institutionId: cuidSchema,
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type DeleteInstitutionInput = z.infer<typeof deleteInstitutionSchema>;

// ─── Table Types ──────────────────────────────────────────────────

export const TOGGLEABLE_COLUMNS = [
  { key: "category", label: m.transactions.fields.category },
  { key: "subcategory", label: m.transactions.fields.subcategory },
  { key: "institution", label: m.transactions.fields.institution },
  { key: "paymentMethod", label: m.transactions.fields.paymentMethod },
  { key: "responsibleUser", label: m.transactions.fields.responsibleUser },
  { key: "isPending", label: m.transactions.fields.isPending },
  { key: "notes", label: m.transactions.fields.notes },
  { key: "cardInstallment", label: m.transactions.fields.cardInstallment },
  { key: "investmentType", label: m.transactions.fields.investmentType },
  { key: "expenseType", label: m.transactions.fields.expenseType },
  { key: "tags", label: m.transactions.fields.tags },
] as const;

// Schema derivado das colunas configuráveis — strips chaves desconhecidas em inputs
const hiddenColumnsBaseSchema = z.object({
  category: z.boolean().optional(),
  subcategory: z.boolean().optional(),
  institution: z.boolean().optional(),
  paymentMethod: z.boolean().optional(),
  responsibleUser: z.boolean().optional(),
  isPending: z.boolean().optional(),
  notes: z.boolean().optional(),
  cardInstallment: z.boolean().optional(),
  investmentType: z.boolean().optional(),
  expenseType: z.boolean().optional(),
  tags: z.boolean().optional(),
});

// Para leituras do banco: fallback para {} se o JSON estiver corrompido ou com chaves desconhecidas
export const hiddenColumnsSchema = hiddenColumnsBaseSchema.catch({});
export type HiddenColumns = Record<string, boolean>;

export function parseHiddenColumns(raw: unknown): HiddenColumns {
  return hiddenColumnsSchema.parse(raw ?? {}) as HiddenColumns;
}

// Layout da linha por tipo de tabela (Spec 66 TX-04b): "columns" (A, default,
// colunas explícitas) × "rich" (B, descrição + pílulas). Default reproduz o
// comportamento atual.
export const ROW_LAYOUTS = ["columns", "rich"] as const;
export const rowLayoutSchema = z.enum(ROW_LAYOUTS);
export type RowLayout = z.infer<typeof rowLayoutSchema>;

export const createTableTypeSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
  hiddenColumns: hiddenColumnsBaseSchema,
  rowLayout: rowLayoutSchema.optional(),
});

export const updateTableTypeSchema = z.object({
  tableTypeId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(50).trim().optional(),
  hiddenColumns: hiddenColumnsBaseSchema.optional(),
  rowLayout: rowLayoutSchema.optional(),
});

export const deleteTableTypeSchema = z.object({
  tableTypeId: cuidSchema,
});

export type CreateTableTypeInput = z.infer<typeof createTableTypeSchema>;
export type UpdateTableTypeInput = z.infer<typeof updateTableTypeSchema>;
export type DeleteTableTypeInput = z.infer<typeof deleteTableTypeSchema>;

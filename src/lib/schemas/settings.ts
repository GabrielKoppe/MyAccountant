import { z } from "zod";

// ─── Account General ──────────────────────────────────────────────

export const updateAccountSettingsSchema = z.object({
  accountName: z.string().min(1, "Nome obrigatório").max(80).trim(),
  currency: z.enum(["BRL"]),
  monthStartDay: z.number().int().min(1).max(28),
  defaultResponsibleUserId: z.string().cuid("ID inválido").nullable().optional(),
});

export type UpdateAccountSettingsInput = z.infer<typeof updateAccountSettingsSchema>;

// ─── Sections ─────────────────────────────────────────────────────

export const createSectionSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(40).trim(),
  countType: z.enum(["add", "subtract", "ignore", "neutral"]),
  isActive: z.boolean(),
});

export const updateSectionSchema = z.object({
  sectionId: z.string().cuid("ID inválido"),
  name: z.string().min(1, "Nome obrigatório").max(40).trim(),
  countType: z.enum(["add", "subtract", "ignore", "neutral"]),
  isActive: z.boolean(),
});

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(z.string().cuid("ID inválido")).min(1),
});

export const deleteSectionSchema = z.object({
  sectionId: z.string().cuid("ID inválido"),
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
  categoryId: z.string().cuid("ID inválido"),
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
});

export const deleteCategorySchema = z.object({
  categoryId: z.string().cuid("ID inválido"),
});

export const createSubcategorySchema = z.object({
  categoryId: z.string().cuid("ID inválido"),
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
});

export const updateSubcategorySchema = z.object({
  subcategoryId: z.string().cuid("ID inválido"),
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
});

export const deleteSubcategorySchema = z.object({
  subcategoryId: z.string().cuid("ID inválido"),
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
  institutionId: z.string().cuid("ID inválido"),
  name: z.string().min(1, "Nome obrigatório").max(80).trim(),
});

export const deleteInstitutionSchema = z.object({
  institutionId: z.string().cuid("ID inválido"),
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type DeleteInstitutionInput = z.infer<typeof deleteInstitutionSchema>;

// ─── Table Types ──────────────────────────────────────────────────

export const createTableTypeSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
  hiddenColumns: z.record(z.string(), z.boolean()),
});

export const updateTableTypeSchema = z.object({
  tableTypeId: z.string().cuid("ID inválido"),
  name: z.string().min(1, "Nome obrigatório").max(50).trim().optional(),
  hiddenColumns: z.record(z.string(), z.boolean()).optional(),
});

export const deleteTableTypeSchema = z.object({
  tableTypeId: z.string().cuid("ID inválido"),
});

export type CreateTableTypeInput = z.infer<typeof createTableTypeSchema>;
export type UpdateTableTypeInput = z.infer<typeof updateTableTypeSchema>;
export type DeleteTableTypeInput = z.infer<typeof deleteTableTypeSchema>;

export const TOGGLEABLE_COLUMNS = [
  { key: "category", label: "Categoria" },
  { key: "subcategory", label: "Subcategoria" },
  { key: "institution", label: "Instituição" },
  { key: "responsibleUser", label: "Responsável" },
  { key: "isPending", label: "Pendente" },
  { key: "notes", label: "Notas" },
  { key: "cardInstallment", label: "Parcela do cartão" },
  { key: "investmentType", label: "Tipo de investimento" },
] as const;

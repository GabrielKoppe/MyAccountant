"use server";

import { forecastSettingsSchema } from "@/lib/schemas/forecast";
import {
  createCategorySchema,
  createInstitutionSchema,
  createSectionSchema,
  createSubcategorySchema,
  createTableTypeSchema,
  deleteCategorySchema,
  deleteInstitutionSchema,
  deleteSectionSchema,
  deleteSubcategorySchema,
  deleteTableTypeSchema,
  reorderSectionsSchema,
  updateAccountSettingsSchema,
  updateCategorySchema,
  updateInstitutionSchema,
  updateSectionSchema,
  updateSubcategorySchema,
  updateTableTypeSchema,
} from "@/lib/schemas/settings";
import { defineAction } from "@/server/api/define-action";
import {
  revalidateGeneralSettings,
  revalidateForecastSettings,
  revalidateSections,
  revalidateCategories,
  revalidateInstitutions,
  revalidateTableTypes,
} from "@/server/api/revalidate";
import * as accountSettingsService from "@/server/services/account-settings-service";
import * as categoryService from "@/server/services/category-service";
import * as institutionService from "@/server/services/institution-service";
import * as sectionService from "@/server/services/section-service";
import * as tableTypeService from "@/server/services/table-type-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

// ─── Account General ──────────────────────────────────────────────

export const updateAccountSettingsAction = defineAction({
  schema: updateAccountSettingsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await accountSettingsService.updateAccountSettings(input, ctx);
    revalidateGeneralSettings(ctx.accountId);
  },
});

// ─── Forecast (spec 48) ───────────────────────────────────────────

export const updateForecastSettingsAction = defineAction({
  schema: forecastSettingsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await accountSettingsService.updateForecastSettings(input, ctx);
    revalidateForecastSettings(ctx.accountId);
  },
});

// ─── Sections ─────────────────────────────────────────────────────

export const createSectionAction = defineAction({
  schema: createSectionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await sectionService.createSection(input, ctx);
    revalidateSections(ctx.accountId);
    return result;
  },
});

export const updateSectionAction = defineAction({
  schema: updateSectionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await sectionService.updateSection(input, ctx);
    revalidateSections(ctx.accountId);
  },
});

export const reorderSectionsAction = defineAction({
  schema: reorderSectionsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await sectionService.reorderSections(input, ctx);
    revalidateSections(ctx.accountId);
  },
});

export const deleteSectionAction = defineAction({
  schema: deleteSectionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await sectionService.deleteSection(input, ctx);
    revalidateSections(ctx.accountId);
  },
});

// ─── Categories ───────────────────────────────────────────────────

export const createCategoryAction = defineAction({
  schema: createCategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await categoryService.createCategory(input, ctx);
    revalidateCategories(ctx.accountId);
    return result;
  },
});

export const updateCategoryAction = defineAction({
  schema: updateCategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await categoryService.updateCategory(input, ctx);
    revalidateCategories(ctx.accountId);
  },
});

export const deleteCategoryAction = defineAction({
  schema: deleteCategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await categoryService.deleteCategory(input, ctx);
    revalidateCategories(ctx.accountId);
  },
});

export const createSubcategoryAction = defineAction({
  schema: createSubcategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await categoryService.createSubcategory(input, ctx);
    revalidateCategories(ctx.accountId);
    return result;
  },
});

export const updateSubcategoryAction = defineAction({
  schema: updateSubcategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await categoryService.updateSubcategory(input, ctx);
    revalidateCategories(ctx.accountId);
  },
});

export const deleteSubcategoryAction = defineAction({
  schema: deleteSubcategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await categoryService.deleteSubcategory(input, ctx);
    revalidateCategories(ctx.accountId);
  },
});

// ─── Institutions ─────────────────────────────────────────────────

export const createInstitutionAction = defineAction({
  schema: createInstitutionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await institutionService.createInstitution(input, ctx);
    revalidateInstitutions(ctx.accountId);
    return result;
  },
});

export const updateInstitutionAction = defineAction({
  schema: updateInstitutionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await institutionService.updateInstitution(input, ctx);
    revalidateInstitutions(ctx.accountId);
  },
});

export const deleteInstitutionAction = defineAction({
  schema: deleteInstitutionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await institutionService.deleteInstitution(input, ctx);
    revalidateInstitutions(ctx.accountId);
  },
});

// ─── Table Types ──────────────────────────────────────────────────

export const createTableTypeAction = defineAction({
  schema: createTableTypeSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await tableTypeService.createTableType(input, ctx);
    revalidateTableTypes(ctx.accountId);
    return result;
  },
});

export const updateTableTypeAction = defineAction({
  schema: updateTableTypeSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await tableTypeService.updateTableType(input, ctx);
    revalidateTableTypes(ctx.accountId);
  },
});

export const deleteTableTypeAction = defineAction({
  schema: deleteTableTypeSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await tableTypeService.deleteTableType(input, ctx);
    revalidateTableTypes(ctx.accountId);
  },
});

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
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
import * as settingsService from "@/server/services/settings-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

// ─── Account General ──────────────────────────────────────────────

export const updateAccountSettingsAction = defineAction({
  schema: updateAccountSettingsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.updateAccountSettings(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/general`);
    revalidatePath(`/${ctx.accountId}`);
  },
});

// ─── Sections ─────────────────────────────────────────────────────

export const createSectionAction = defineAction({
  schema: createSectionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await settingsService.createSection(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/sections`);
    return result;
  },
});

export const updateSectionAction = defineAction({
  schema: updateSectionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.updateSection(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/sections`);
  },
});

export const reorderSectionsAction = defineAction({
  schema: reorderSectionsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.reorderSections(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/sections`);
  },
});

export const deleteSectionAction = defineAction({
  schema: deleteSectionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.deleteSection(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/sections`);
  },
});

// ─── Categories ───────────────────────────────────────────────────

export const createCategoryAction = defineAction({
  schema: createCategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await settingsService.createCategory(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/categories`);
    return result;
  },
});

export const updateCategoryAction = defineAction({
  schema: updateCategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.updateCategory(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/categories`);
  },
});

export const deleteCategoryAction = defineAction({
  schema: deleteCategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.deleteCategory(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/categories`);
  },
});

export const createSubcategoryAction = defineAction({
  schema: createSubcategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await settingsService.createSubcategory(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/categories`);
    return result;
  },
});

export const updateSubcategoryAction = defineAction({
  schema: updateSubcategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.updateSubcategory(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/categories`);
  },
});

export const deleteSubcategoryAction = defineAction({
  schema: deleteSubcategorySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.deleteSubcategory(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/categories`);
  },
});

// ─── Institutions ─────────────────────────────────────────────────

export const createInstitutionAction = defineAction({
  schema: createInstitutionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await settingsService.createInstitution(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/institutions`);
    return result;
  },
});

export const updateInstitutionAction = defineAction({
  schema: updateInstitutionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.updateInstitution(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/institutions`);
  },
});

export const deleteInstitutionAction = defineAction({
  schema: deleteInstitutionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.deleteInstitution(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/institutions`);
  },
});

// ─── Table Types ──────────────────────────────────────────────────

export const createTableTypeAction = defineAction({
  schema: createTableTypeSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await settingsService.createTableType(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/table-types`);
    return result;
  },
});

export const updateTableTypeAction = defineAction({
  schema: updateTableTypeSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.updateTableType(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/table-types`);
  },
});

export const deleteTableTypeAction = defineAction({
  schema: deleteTableTypeSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await settingsService.deleteTableType(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/table-types`);
  },
});

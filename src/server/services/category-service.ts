import { ConflictError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateCategoryInput,
  CreateSubcategoryInput,
  DeleteCategoryInput,
  DeleteSubcategoryInput,
  UpdateCategoryInput,
  UpdateSubcategoryInput,
} from "@/lib/schemas/settings";

const log = logger.child({ module: "category-service" });

export async function createCategory(input: CreateCategoryInput, ctx: ActionContext) {
  const existing = await prisma.category.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe uma categoria com este nome.");

  const category = await prisma.category.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      createdById: ctx.userId,
    },
    select: { id: true },
  });

  log.info({ categoryId: category.id, accountId: ctx.accountId }, "Category created");
  return { categoryId: category.id };
}

export async function updateCategory(input: UpdateCategoryInput, ctx: ActionContext) {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { accountId: true },
  });
  if (!category || category.accountId !== ctx.accountId) throw new NotFoundError("Categoria");

  const nameConflict = await prisma.category.findFirst({
    where: { accountId: ctx.accountId, name: input.name, id: { not: input.categoryId } },
  });
  if (nameConflict) throw new ConflictError("Já existe uma categoria com este nome.");

  await prisma.category.update({
    where: { id: input.categoryId },
    data: { name: input.name },
  });

  log.info({ categoryId: input.categoryId, accountId: ctx.accountId }, "Category updated");
}

export async function deleteCategory(input: DeleteCategoryInput, ctx: ActionContext) {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { accountId: true },
  });
  if (!category || category.accountId !== ctx.accountId) throw new NotFoundError("Categoria");

  await prisma.category.delete({ where: { id: input.categoryId } });

  log.info({ categoryId: input.categoryId, accountId: ctx.accountId }, "Category deleted");
}

export async function createSubcategory(input: CreateSubcategoryInput, ctx: ActionContext) {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { accountId: true },
  });
  if (!category || category.accountId !== ctx.accountId) throw new NotFoundError("Categoria");

  const existing = await prisma.subcategory.findUnique({
    where: { categoryId_name: { categoryId: input.categoryId, name: input.name } },
  });
  if (existing)
    throw new ConflictError("Já existe uma subcategoria com este nome nesta categoria.");

  const sub = await prisma.subcategory.create({
    data: {
      categoryId: input.categoryId,
      accountId: ctx.accountId,
      name: input.name,
    },
    select: { id: true },
  });

  log.info({ subcategoryId: sub.id, accountId: ctx.accountId }, "Subcategory created");
  return { subcategoryId: sub.id };
}

export async function updateSubcategory(input: UpdateSubcategoryInput, ctx: ActionContext) {
  const sub = await prisma.subcategory.findUnique({
    where: { id: input.subcategoryId },
    select: { accountId: true, categoryId: true },
  });
  if (!sub || sub.accountId !== ctx.accountId) throw new NotFoundError("Subcategoria");

  const nameConflict = await prisma.subcategory.findFirst({
    where: {
      categoryId: sub.categoryId,
      name: input.name,
      id: { not: input.subcategoryId },
    },
  });
  if (nameConflict) throw new ConflictError("Já existe uma subcategoria com este nome.");

  await prisma.subcategory.update({
    where: { id: input.subcategoryId },
    data: { name: input.name },
  });

  log.info(
    { subcategoryId: input.subcategoryId, accountId: ctx.accountId },
    "Subcategory updated",
  );
}

export async function deleteSubcategory(input: DeleteSubcategoryInput, ctx: ActionContext) {
  const sub = await prisma.subcategory.findUnique({
    where: { id: input.subcategoryId },
    select: { accountId: true },
  });
  if (!sub || sub.accountId !== ctx.accountId) throw new NotFoundError("Subcategoria");

  await prisma.subcategory.delete({ where: { id: input.subcategoryId } });

  log.info(
    { subcategoryId: input.subcategoryId, accountId: ctx.accountId },
    "Subcategory deleted",
  );
}

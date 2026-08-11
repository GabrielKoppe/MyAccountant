import type {
  CreateCategoryInput,
  CreateSubcategoryInput,
  DeleteCategoryInput,
  DeleteSubcategoryInput,
  ReorderCategoriesInput,
  ReorderSubcategoriesInput,
  UpdateCategoryInput,
  UpdateSubcategoryInput,
} from "@/lib/schemas/settings";
import type { ActionContext } from "@/server/api/define-action";
import { ConflictError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "category-service" });

export async function createCategory(input: CreateCategoryInput, ctx: ActionContext) {
  const existing = await prisma.category.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe uma categoria com este nome.");

  // A categoria nova entra no FIM da ordem manual — que é onde a linha-fantasma está.
  const maxOrder = await prisma.category.aggregate({
    where: { accountId: ctx.accountId },
    _max: { order: true },
  });

  const category = await prisma.category.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      createdById: ctx.userId,
      order: (maxOrder._max.order ?? -1) + 1,
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

  // `defaultSectionId` não é mais lido daqui — a UI abandonou "Seção padrão" nesta
  // revisão (o campo continua no banco, deprecado, sem migração destrutiva).
  await prisma.category.update({
    where: { id: input.categoryId },
    data: {
      name: input.name,
      status: input.status,
    },
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

  const maxOrder = await prisma.subcategory.aggregate({
    where: { categoryId: input.categoryId },
    _max: { order: true },
  });

  const sub = await prisma.subcategory.create({
    data: {
      categoryId: input.categoryId,
      accountId: ctx.accountId,
      name: input.name,
      order: (maxOrder._max.order ?? -1) + 1,
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
    data: { name: input.name, status: input.status },
  });

  log.info({ subcategoryId: input.subcategoryId, accountId: ctx.accountId }, "Subcategory updated");
}

export async function deleteSubcategory(input: DeleteSubcategoryInput, ctx: ActionContext) {
  const sub = await prisma.subcategory.findUnique({
    where: { id: input.subcategoryId },
    select: { accountId: true },
  });
  if (!sub || sub.accountId !== ctx.accountId) throw new NotFoundError("Subcategoria");

  await prisma.subcategory.delete({ where: { id: input.subcategoryId } });

  log.info({ subcategoryId: input.subcategoryId, accountId: ctx.accountId }, "Subcategory deleted");
}

/**
 * Spec 68 §2.2 — persiste a ordem manual das categorias de topo.
 *
 * Mesmo padrão de `reorderSections`: `updateMany` com `accountId` no where, dentro de
 * uma transação. Um id de outra conta não casa e vira um no-op silencioso — a operação
 * não pode reordenar o que não é dela, nem falhar por causa de um id intruso no meio
 * de um arraste legítimo.
 */
export async function reorderCategories(input: ReorderCategoriesInput, ctx: ActionContext) {
  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.category.updateMany({
        where: { id, accountId: ctx.accountId },
        data: { order: index },
      }),
    ),
  );

  log.info({ accountId: ctx.accountId, count: input.orderedIds.length }, "Categories reordered");
}

/** Ordem das subcategorias DENTRO de uma categoria. */
export async function reorderSubcategories(input: ReorderSubcategoriesInput, ctx: ActionContext) {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { accountId: true },
  });
  if (!category || category.accountId !== ctx.accountId) throw new NotFoundError("Categoria");

  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.subcategory.updateMany({
        // `categoryId` no where além do `accountId`: impede reordenar uma subcategoria
        // de OUTRA categoria da mesma conta passando o id dela na lista.
        where: { id, accountId: ctx.accountId, categoryId: input.categoryId },
        data: { order: index },
      }),
    ),
  );

  log.info(
    { accountId: ctx.accountId, categoryId: input.categoryId, count: input.orderedIds.length },
    "Subcategories reordered",
  );
}

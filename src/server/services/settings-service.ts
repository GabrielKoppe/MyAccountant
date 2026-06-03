import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateCategoryInput,
  CreateInstitutionInput,
  CreateSectionInput,
  CreateSubcategoryInput,
  CreateTableTypeInput,
  DeleteCategoryInput,
  DeleteInstitutionInput,
  DeleteSectionInput,
  DeleteSubcategoryInput,
  DeleteTableTypeInput,
  ReorderSectionsInput,
  UpdateAccountSettingsInput,
  UpdateCategoryInput,
  UpdateInstitutionInput,
  UpdateSectionInput,
  UpdateSubcategoryInput,
  UpdateTableTypeInput,
} from "@/lib/schemas/settings";

const log = logger.child({ module: "settings-service" });

// ─── Account General ──────────────────────────────────────────────

export async function updateAccountSettings(
  input: UpdateAccountSettingsInput,
  ctx: ActionContext,
) {
  const { accountName, currency, monthStartDay, defaultResponsibleUserId } = input;

  await prisma.$transaction([
    prisma.account.update({
      where: { id: ctx.accountId },
      data: { name: accountName },
    }),
    prisma.accountSettings.update({
      where: { accountId: ctx.accountId },
      data: { currency, monthStartDay, defaultResponsibleUserId: defaultResponsibleUserId ?? null },
    }),
  ]);

  log.info({ accountId: ctx.accountId }, "Account settings updated");
}

// ─── Sections ─────────────────────────────────────────────────────

export async function createSection(input: CreateSectionInput, ctx: ActionContext) {
  const maxOrder = await prisma.section.aggregate({
    where: { accountId: ctx.accountId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const existing = await prisma.section.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe uma seção com este nome.");

  const section = await prisma.section.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      countType: input.countType,
      isActive: input.isActive,
      order: nextOrder,
    },
    select: { id: true, name: true },
  });

  log.info({ sectionId: section.id, accountId: ctx.accountId }, "Section created");
  return { sectionId: section.id };
}

export async function updateSection(input: UpdateSectionInput, ctx: ActionContext) {
  const section = await prisma.section.findUnique({
    where: { id: input.sectionId },
    select: { accountId: true },
  });
  if (!section || section.accountId !== ctx.accountId) throw new NotFoundError("Seção");

  if (input.name) {
    const nameConflict = await prisma.section.findFirst({
      where: {
        accountId: ctx.accountId,
        name: input.name,
        id: { not: input.sectionId },
      },
    });
    if (nameConflict) throw new ConflictError("Já existe uma seção com este nome.");
  }

  await prisma.section.update({
    where: { id: input.sectionId },
    data: {
      name: input.name,
      countType: input.countType,
      isActive: input.isActive,
    },
  });

  log.info({ sectionId: input.sectionId, accountId: ctx.accountId }, "Section updated");
}

export async function reorderSections(input: ReorderSectionsInput, ctx: ActionContext) {
  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.section.updateMany({
        where: { id, accountId: ctx.accountId },
        data: { order: index },
      }),
    ),
  );

  log.info({ accountId: ctx.accountId }, "Sections reordered");
}

export async function deleteSection(input: DeleteSectionInput, ctx: ActionContext) {
  const section = await prisma.section.findUnique({
    where: { id: input.sectionId },
    select: { accountId: true },
  });
  if (!section || section.accountId !== ctx.accountId) throw new NotFoundError("Seção");

  const tableCount = await prisma.financeTable.count({
    where: { sectionId: input.sectionId, accountId: ctx.accountId },
  });
  if (tableCount > 0) {
    throw new ConflictError(
      `Não é possível deletar: há ${tableCount} tabela(s) financeira(s) associada(s). Desative a seção em vez de deletar.`,
    );
  }

  await prisma.section.delete({ where: { id: input.sectionId } });

  log.info({ sectionId: input.sectionId, accountId: ctx.accountId }, "Section deleted");
}

// ─── Categories ───────────────────────────────────────────────────

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
  if (existing) throw new ConflictError("Já existe uma subcategoria com este nome nesta categoria.");

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

// ─── Institutions ─────────────────────────────────────────────────

export async function createInstitution(input: CreateInstitutionInput, ctx: ActionContext) {
  const existing = await prisma.institution.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe uma instituição com este nome.");

  const institution = await prisma.institution.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      createdById: ctx.userId,
    },
    select: { id: true },
  });

  log.info({ institutionId: institution.id, accountId: ctx.accountId }, "Institution created");
  return { institutionId: institution.id };
}

export async function updateInstitution(input: UpdateInstitutionInput, ctx: ActionContext) {
  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { accountId: true },
  });
  if (!institution || institution.accountId !== ctx.accountId) throw new NotFoundError("Instituição");

  const nameConflict = await prisma.institution.findFirst({
    where: {
      accountId: ctx.accountId,
      name: input.name,
      id: { not: input.institutionId },
    },
  });
  if (nameConflict) throw new ConflictError("Já existe uma instituição com este nome.");

  await prisma.institution.update({
    where: { id: input.institutionId },
    data: { name: input.name },
  });

  log.info({ institutionId: input.institutionId, accountId: ctx.accountId }, "Institution updated");
}

export async function deleteInstitution(input: DeleteInstitutionInput, ctx: ActionContext) {
  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { accountId: true },
  });
  if (!institution || institution.accountId !== ctx.accountId) throw new NotFoundError("Instituição");

  await prisma.institution.delete({ where: { id: input.institutionId } });

  log.info({ institutionId: input.institutionId, accountId: ctx.accountId }, "Institution deleted");
}

// ─── Table Types ──────────────────────────────────────────────────

export async function createTableType(input: CreateTableTypeInput, ctx: ActionContext) {
  const existing = await prisma.tableType.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe um tipo de tabela com este nome.");

  const onlyHidden: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(input.hiddenColumns)) {
    if (value) onlyHidden[key] = true;
  }

  const tableType = await prisma.tableType.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      isDefault: false,
      hiddenColumns: onlyHidden,
    },
    select: { id: true },
  });

  log.info({ tableTypeId: tableType.id, accountId: ctx.accountId }, "TableType created");
  return { tableTypeId: tableType.id };
}

export async function updateTableType(input: UpdateTableTypeInput, ctx: ActionContext) {
  const tableType = await prisma.tableType.findUnique({
    where: { id: input.tableTypeId },
    select: { accountId: true, isDefault: true },
  });
  if (!tableType || tableType.accountId !== ctx.accountId) throw new NotFoundError("Tipo de tabela");

  if (input.name && !tableType.isDefault) {
    const nameConflict = await prisma.tableType.findFirst({
      where: { accountId: ctx.accountId, name: input.name, id: { not: input.tableTypeId } },
    });
    if (nameConflict) throw new ConflictError("Já existe um tipo com este nome.");
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.hiddenColumns !== undefined && !tableType.isDefault) {
    const onlyHidden: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(input.hiddenColumns)) {
      if (value) onlyHidden[key] = true;
    }
    data.hiddenColumns = onlyHidden;
  }

  await prisma.tableType.update({ where: { id: input.tableTypeId }, data });

  log.info({ tableTypeId: input.tableTypeId, accountId: ctx.accountId }, "TableType updated");
}

export async function deleteTableType(input: DeleteTableTypeInput, ctx: ActionContext) {
  const tableType = await prisma.tableType.findUnique({
    where: { id: input.tableTypeId },
    select: { accountId: true, isDefault: true },
  });
  if (!tableType || tableType.accountId !== ctx.accountId) throw new NotFoundError("Tipo de tabela");
  if (tableType.isDefault) throw new ForbiddenError("O tipo padrão não pode ser deletado.");

  const tableCount = await prisma.financeTable.count({
    where: { tableTypeId: input.tableTypeId, accountId: ctx.accountId },
  });
  if (tableCount > 0) {
    throw new ConflictError(
      `Não é possível deletar: há ${tableCount} tabela(s) usando este tipo.`,
    );
  }

  await prisma.tableType.delete({ where: { id: input.tableTypeId } });

  log.info({ tableTypeId: input.tableTypeId, accountId: ctx.accountId }, "TableType deleted");
}

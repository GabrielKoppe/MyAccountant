import { prisma } from "@/server/prisma";
import { NotFoundError, ConflictError } from "@/server/api/errors";
import { applyDayToMonth } from "@/lib/dates";
import { logger } from "@/server/logger";
import type { ActionContext } from "@/server/api/define-action";
import type {
  AddTemplateItemInput,
  ApplyTemplateInput,
  CreateTemplateFromTableInput,
  CreateTemplateManualInput,
  DeleteTemplateInput,
  DeleteTemplateItemInput,
  UpdateTemplateInput,
  UpdateTemplateItemInput,
} from "@/lib/schemas/table-template";

const log = logger.child({ module: "table-template-service" });

async function getTemplateOrThrow(templateId: string, accountId: string) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: templateId, accountId },
    include: { items: { orderBy: [{ displayOrder: "asc" }, { day: "asc" }] } },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");
  return tpl;
}

export async function listTemplates(accountId: string) {
  return prisma.tableTemplate.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { items: true } },
      tableType: { select: { id: true, name: true } },
      items: {
        orderBy: [{ displayOrder: "asc" }, { day: "asc" }],
        select: {
          id: true,
          day: true,
          amountCents: true,
          description: true,
          isPending: true,
          categoryId: true,
          subcategoryId: true,
          institutionId: true,
          responsibleUserId: true,
          cardInstallment: true,
          investmentType: true,
          displayOrder: true,
        },
      },
    },
  });
}

export async function createFromTable(
  input: CreateTemplateFromTableInput,
  ctx: ActionContext,
) {
  const existing = await prisma.tableTemplate.findFirst({
    where: { accountId: ctx.accountId, name: input.name },
  });
  if (existing) throw new ConflictError(`Já existe um modelo com o nome "${input.name}".`);

  const table = await prisma.financeTable.findFirst({
    where: { id: input.tableId, accountId: ctx.accountId },
    include: {
      transactions: {
        orderBy: { occurredOn: "asc" },
        select: {
          occurredOn: true,
          amountCents: true,
          description: true,
          notes: true,
          isPending: true,
          categoryId: true,
          subcategoryId: true,
          institutionId: true,
          responsibleUserId: true,
          cardInstallment: true,
          investmentType: true,
        },
      },
    },
  });
  if (!table) throw new NotFoundError("Tabela financeira");

  return prisma.tableTemplate.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      tableTypeId: table.tableTypeId,
      countInMonth: table.countInMonth,
      createdById: ctx.userId,
      items: {
        create: table.transactions.map((tx, i) => ({
          accountId: ctx.accountId,
          // Extrai o dia em UTC (occurredOn é @db.Date sem timezone)
          day: tx.occurredOn.getUTCDate(),
          amountCents: tx.amountCents,
          description: tx.description,
          notes: tx.notes,
          isPending: tx.isPending,
          categoryId: tx.categoryId,
          subcategoryId: tx.subcategoryId,
          institutionId: tx.institutionId,
          responsibleUserId: tx.responsibleUserId,
          cardInstallment: tx.cardInstallment,
          investmentType: tx.investmentType,
          displayOrder: i,
        })),
      },
    },
    select: { id: true, name: true, _count: { select: { items: true } } },
  });
}

export async function createManual(
  input: CreateTemplateManualInput,
  ctx: ActionContext,
) {
  const existing = await prisma.tableTemplate.findFirst({
    where: { accountId: ctx.accountId, name: input.name },
  });
  if (existing) throw new ConflictError(`Já existe um modelo com o nome "${input.name}".`);

  const countInMonth = input.countInMonth ?? true;

  return prisma.tableTemplate.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      description: input.description,
      tableTypeId: input.tableTypeId ?? null,
      countInMonth,
      createdById: ctx.userId,
    },
    select: { id: true, name: true },
  });
}

export async function updateTemplate(input: UpdateTemplateInput, ctx: ActionContext) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");

  return prisma.tableTemplate.update({
    where: { id: input.templateId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.tableTypeId !== undefined ? { tableTypeId: input.tableTypeId } : {}),
      ...(input.countInMonth !== undefined ? { countInMonth: input.countInMonth } : {}),
    },
    select: { id: true, name: true },
  });
}

export async function deleteTemplate(input: DeleteTemplateInput, ctx: ActionContext) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");

  await prisma.tableTemplate.delete({ where: { id: input.templateId } });
  log.info({ templateId: input.templateId }, "Table template deleted");
}

export async function addItem(input: AddTemplateItemInput, ctx: ActionContext) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");

  const maxOrder = await prisma.tableTemplateItem.aggregate({
    where: { templateId: input.templateId },
    _max: { displayOrder: true },
  });

  return prisma.tableTemplateItem.create({
    data: {
      templateId: input.templateId,
      accountId: ctx.accountId,
      day: input.day,
      amountCents: BigInt(input.amountCents),
      description: input.description ?? null,
      notes: input.notes ?? null,
      isPending: input.isPending ?? false,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      institutionId: input.institutionId ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      cardInstallment: input.cardInstallment ?? null,
      investmentType: input.investmentType ?? null,
      displayOrder: input.displayOrder ?? ((maxOrder._max.displayOrder ?? -1) + 1),
    },
  });
}

export async function updateItem(input: UpdateTemplateItemInput, ctx: ActionContext) {
  const item = await prisma.tableTemplateItem.findFirst({
    where: { id: input.itemId, accountId: ctx.accountId },
  });
  if (!item) throw new NotFoundError("Item do modelo");

  const { itemId, amountCents, ...rest } = input;
  return prisma.tableTemplateItem.update({
    where: { id: itemId },
    data: {
      ...rest,
      ...(amountCents !== undefined ? { amountCents: BigInt(amountCents) } : {}),
    },
  });
}

export async function deleteItem(input: DeleteTemplateItemInput, ctx: ActionContext) {
  const item = await prisma.tableTemplateItem.findFirst({
    where: { id: input.itemId, accountId: ctx.accountId },
  });
  if (!item) throw new NotFoundError("Item do modelo");

  await prisma.tableTemplateItem.delete({ where: { id: input.itemId } });
}

export async function applyTemplate(
  input: ApplyTemplateInput,
  ctx: ActionContext,
): Promise<{ tableId: string }> {
  const template = await getTemplateOrThrow(input.templateId, ctx.accountId);

  const [month, section] = await Promise.all([
    prisma.month.findFirst({ where: { id: input.monthId, accountId: ctx.accountId } }),
    prisma.section.findFirst({ where: { id: input.sectionId, accountId: ctx.accountId } }),
  ]);
  if (!month) throw new NotFoundError("Mês");
  if (!section) throw new NotFoundError("Seção");

  const result = await prisma.$transaction(async (tx) => {
    const tableCount = await tx.financeTable.count({
      where: { monthId: input.monthId, sectionId: input.sectionId },
    });

    const table = await tx.financeTable.create({
      data: {
        accountId: ctx.accountId,
        monthId: input.monthId,
        sectionId: input.sectionId,
        tableTypeId: input.tableTypeId ?? template.tableTypeId,
        name: input.name,
        countInMonth: input.countInMonth ?? template.countInMonth,
        sourceMethod: "template",
        displayOrder: tableCount,
        createdById: ctx.userId,
      },
    });

    if (template.items.length > 0) {
      await tx.transaction.createMany({
        data: template.items.map((item) => ({
          accountId: ctx.accountId,
          monthId: input.monthId,
          tableId: table.id,
          sectionId: input.sectionId,
          occurredOn: applyDayToMonth(item.day, month.year, month.month),
          amountCents: item.amountCents,
          description: item.description,
          notes: item.notes,
          isPending: item.isPending,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          institutionId: item.institutionId,
          responsibleUserId: item.responsibleUserId,
          cardInstallment: item.cardInstallment,
          investmentType: item.investmentType,
          createdById: ctx.userId,
          metadata: {},
        })),
      });
    }

    return table;
  });

  log.info(
    { templateId: input.templateId, tableId: result.id, items: template.items.length },
    "Template applied",
  );
  return { tableId: result.id };
}

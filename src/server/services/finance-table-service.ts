import { getDaysInMonth } from "date-fns";

import { AppError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateFinanceTableInput,
  DeleteFinanceTableInput,
  ReorderFinanceTablesInput,
  UpdateFinanceTableInput,
} from "@/lib/schemas/finance-table";

const log = logger.child({ module: "finance-table-service" });

function remapDateToMonth(date: Date, targetYear: number, targetMonth: number): Date {
  const day = date.getDate();
  const daysInTarget = getDaysInMonth(new Date(targetYear, targetMonth - 1));
  return new Date(targetYear, targetMonth - 1, Math.min(day, daysInTarget));
}

async function getNextDisplayOrder(
  accountId: string,
  monthId: string,
  sectionId: string,
): Promise<number> {
  const agg = await prisma.financeTable.aggregate({
    where: { accountId, monthId, sectionId },
    _max: { displayOrder: true },
  });
  return (agg._max.displayOrder ?? -1) + 1;
}

export async function createFinanceTable(input: CreateFinanceTableInput, ctx: ActionContext) {
  // Validar que monthId pertence à account
  const month = await prisma.month.findUnique({
    where: { id: input.monthId },
    select: { accountId: true, year: true, month: true },
  });
  if (!month || month.accountId !== ctx.accountId) throw new NotFoundError("Mês");

  // Validar que sectionId pertence à account
  const section = await prisma.section.findUnique({
    where: { id: input.sectionId },
    select: { accountId: true, isActive: true },
  });
  if (!section || section.accountId !== ctx.accountId) throw new NotFoundError("Seção");

  const displayOrder = await getNextDisplayOrder(ctx.accountId, input.monthId, input.sectionId);

  if (input.sourceMethod === "empty") {
    const table = await prisma.financeTable.create({
      data: {
        accountId: ctx.accountId,
        monthId: input.monthId,
        sectionId: input.sectionId,
        name: input.name,
        tableTypeId: input.tableTypeId,
        sourceMethod: "empty",
        countInMonth: input.countInMonth,
        displayOrder,
        createdById: ctx.userId,
      },
      select: { id: true },
    });

    log.info({ tableId: table.id, accountId: ctx.accountId }, "Finance table created (empty)");
    return { tableId: table.id };
  }

  if (input.sourceMethod === "copy") {
    if (!input.sourceTableId) throw new AppError("VALIDATION", "Tabela de origem obrigatória");

    const sourceTable = await prisma.financeTable.findUnique({
      where: { id: input.sourceTableId },
      select: {
        id: true,
        accountId: true,
        tableTypeId: true,
        transactions: {
          select: {
            occurredOn: true,
            amountCents: true,
            description: true,
            notes: true,
            isPending: true,
            isFavorite: true,
            categoryId: true,
            subcategoryId: true,
            institutionId: true,
            institutionText: true,
            responsibleUserId: true,
            cardInstallment: true,
            investmentType: true,
            metadata: true,
          },
        },
      },
    });
    if (!sourceTable || sourceTable.accountId !== ctx.accountId) {
      throw new NotFoundError("Tabela de origem");
    }

    const copyOpts = input.copyOptions ?? {
      includeTransactions: true,
      updateDates: true,
      markAsPending: false,
    };

    const result = await prisma.$transaction(async (tx) => {
      const newTable = await tx.financeTable.create({
        data: {
          accountId: ctx.accountId,
          monthId: input.monthId,
          sectionId: input.sectionId,
          name: input.name,
          tableTypeId: input.tableTypeId,
          sourceMethod: "copy",
          sourceTableId: input.sourceTableId,
          countInMonth: input.countInMonth,
          displayOrder,
          createdById: ctx.userId,
        },
        select: { id: true },
      });

      if (copyOpts.includeTransactions && sourceTable.transactions.length > 0) {
        await tx.transaction.createMany({
          data: sourceTable.transactions.map((t) => ({
            accountId: ctx.accountId,
            monthId: input.monthId,
            tableId: newTable.id,
            sectionId: input.sectionId,
            occurredOn: copyOpts.updateDates
              ? remapDateToMonth(t.occurredOn, month.year, month.month)
              : t.occurredOn,
            amountCents: t.amountCents,
            description: t.description,
            notes: t.notes,
            isPending: copyOpts.markAsPending ? true : t.isPending,
            isFavorite: t.isFavorite,
            categoryId: t.categoryId,
            subcategoryId: t.subcategoryId,
            institutionId: t.institutionId,
            institutionText: t.institutionText,
            responsibleUserId: t.responsibleUserId,
            cardInstallment: t.cardInstallment,
            investmentType: t.investmentType,
            metadata: t.metadata ?? {},
            createdById: ctx.userId,
          })),
        });
      }

      return { tableId: newTable.id };
    });

    log.info({ tableId: result.tableId, accountId: ctx.accountId }, "Finance table created (copy)");
    return result;
  }

  throw new AppError("VALIDATION", "Source method inválido");
}

export async function updateFinanceTable(
  input: UpdateFinanceTableInput,
  ctx: ActionContext,
): Promise<{ monthId: string }> {
  const table = await prisma.financeTable.findUnique({
    where: { id: input.tableId },
    select: { accountId: true, monthId: true },
  });
  if (!table || table.accountId !== ctx.accountId) throw new NotFoundError("Tabela");

  await prisma.financeTable.update({
    where: { id: input.tableId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.countInMonth !== undefined && { countInMonth: input.countInMonth }),
      ...(input.tableTypeId !== undefined && { tableTypeId: input.tableTypeId }),
      updatedById: ctx.userId,
    },
  });

  log.info({ tableId: input.tableId, accountId: ctx.accountId }, "Finance table updated");
  return { monthId: table.monthId };
}

export async function deleteFinanceTable(
  input: DeleteFinanceTableInput,
  ctx: ActionContext,
): Promise<{ monthId: string }> {
  const table = await prisma.financeTable.findUnique({
    where: { id: input.tableId },
    select: { accountId: true, sectionId: true, monthId: true },
  });
  if (!table || table.accountId !== ctx.accountId) throw new NotFoundError("Tabela");

  await prisma.financeTable.delete({ where: { id: input.tableId } });

  log.info({ tableId: input.tableId, accountId: ctx.accountId }, "Finance table deleted");
  return { monthId: table.monthId };
}

export async function reorderFinanceTables(input: ReorderFinanceTablesInput, ctx: ActionContext) {
  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.financeTable.updateMany({
        where: { id, accountId: ctx.accountId, monthId: input.monthId, sectionId: input.sectionId },
        data: { displayOrder: index },
      }),
    ),
  );

  log.info({ accountId: ctx.accountId, sectionId: input.sectionId }, "Finance tables reordered");
}

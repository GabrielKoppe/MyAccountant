import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  BulkDeleteInput,
  BulkUpdateInput,
  CreateTransactionInput,
  DeleteTransactionInput,
  DuplicateTransactionInput,
  MoveTransactionsInput,
  UpdateTransactionInput,
} from "@/lib/schemas/transaction";
import { formatMonthLabel } from "@/lib/dates";
import * as notificationService from "@/server/services/notification-service";

const log = logger.child({ module: "transaction-service" });

async function getTableOrThrow(tableId: string, accountId: string) {
  const table = await prisma.financeTable.findUnique({
    where: { id: tableId },
    select: { accountId: true, sectionId: true, monthId: true },
  });
  if (!table || table.accountId !== accountId) throw new NotFoundError("Tabela");
  return table;
}

async function getTransactionOrThrow(transactionId: string, accountId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { accountId: true, tableId: true, sectionId: true, monthId: true },
  });
  if (!tx || tx.accountId !== accountId) throw new NotFoundError("Transação");
  return tx;
}

export async function createTransaction(input: CreateTransactionInput, ctx: ActionContext) {
  const table = await getTableOrThrow(input.tableId, ctx.accountId);

  const transaction = await prisma.transaction.create({
    data: {
      accountId: ctx.accountId,
      monthId: table.monthId,
      tableId: input.tableId,
      sectionId: table.sectionId,
      occurredOn: input.occurredOn,
      amountCents: input.amountCents,
      description: input.description ?? null,
      notes: input.notes ?? null,
      isPending: input.isPending,
      isFavorite: input.isFavorite,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      institutionId: input.institutionId ?? null,
      institutionText: input.institutionText ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      cardInstallment: input.cardInstallment ?? null,
      investmentType: input.investmentType ?? null,
      createdById: ctx.userId,
    },
    select: { id: true },
  });

  void notificationService.notifyTransactionMutation({
    accountId: ctx.accountId,
    actorId: ctx.userId,
    type: "transactions_added",
    monthId: table.monthId,
  });

  log.info({ transactionId: transaction.id, tableId: input.tableId }, "Transaction created");
  return { transactionId: transaction.id };
}

export async function updateTransaction(input: UpdateTransactionInput, ctx: ActionContext) {
  await getTransactionOrThrow(input.transactionId, ctx.accountId);

  const data: Record<string, unknown> = { updatedById: ctx.userId };

  if (input.occurredOn !== undefined) data.occurredOn = input.occurredOn;
  if (input.amountCents !== undefined) data.amountCents = input.amountCents;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.isPending !== undefined) data.isPending = input.isPending;
  if (input.isFavorite !== undefined) data.isFavorite = input.isFavorite;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId ?? null;
  if (input.subcategoryId !== undefined) data.subcategoryId = input.subcategoryId ?? null;
  if (input.institutionId !== undefined) data.institutionId = input.institutionId ?? null;
  if (input.institutionText !== undefined) data.institutionText = input.institutionText ?? null;
  if (input.responsibleUserId !== undefined) data.responsibleUserId = input.responsibleUserId ?? null;
  if (input.cardInstallment !== undefined) data.cardInstallment = input.cardInstallment ?? null;
  if (input.investmentType !== undefined) data.investmentType = input.investmentType ?? null;

  await prisma.transaction.update({ where: { id: input.transactionId }, data });

  log.info({ transactionId: input.transactionId }, "Transaction updated");
}

export async function deleteTransaction(input: DeleteTransactionInput, ctx: ActionContext) {
  const tx = await getTransactionOrThrow(input.transactionId, ctx.accountId);
  await prisma.transaction.delete({ where: { id: input.transactionId } });

  void notificationService.notifyTransactionMutation({
    accountId: ctx.accountId,
    actorId: ctx.userId,
    type: "transaction_deleted",
    monthId: tx.monthId,
  });

  log.info({ transactionId: input.transactionId }, "Transaction deleted");
}

export async function duplicateTransaction(input: DuplicateTransactionInput, ctx: ActionContext) {
  const source = await prisma.transaction.findUnique({
    where: { id: input.transactionId },
  });
  if (!source || source.accountId !== ctx.accountId) throw new NotFoundError("Transação");

  const newTx = await prisma.transaction.create({
    data: {
      accountId: source.accountId,
      monthId: source.monthId,
      tableId: source.tableId,
      sectionId: source.sectionId,
      occurredOn: source.occurredOn,
      amountCents: source.amountCents,
      description: source.description,
      notes: source.notes,
      isPending: source.isPending,
      isFavorite: source.isFavorite,
      categoryId: source.categoryId,
      subcategoryId: source.subcategoryId,
      institutionId: source.institutionId,
      institutionText: source.institutionText,
      responsibleUserId: source.responsibleUserId,
      cardInstallment: source.cardInstallment,
      investmentType: source.investmentType,
      metadata: source.metadata ?? {},
      createdById: ctx.userId,
    },
    select: { id: true },
  });

  void notificationService.notifyTransactionMutation({
    accountId: ctx.accountId,
    actorId: ctx.userId,
    type: "transactions_added",
    monthId: source.monthId,
  });

  log.info({ sourceId: input.transactionId, newId: newTx.id }, "Transaction duplicated");
  return { transactionId: newTx.id };
}

export async function bulkDelete(input: BulkDeleteInput, ctx: ActionContext) {
  const txs = await prisma.transaction.findMany({
    where: { id: { in: input.ids }, accountId: ctx.accountId },
    select: { monthId: true },
  });

  await prisma.transaction.deleteMany({
    where: { id: { in: input.ids }, accountId: ctx.accountId },
  });

  const uniqueMonthIds = [...new Set(txs.map((t) => t.monthId))];
  for (const monthId of uniqueMonthIds) {
    void notificationService.notifyTransactionMutation({
      accountId: ctx.accountId,
      actorId: ctx.userId,
      type: "transaction_deleted",
      monthId,
    });
  }

  log.info({ count: input.ids.length, accountId: ctx.accountId }, "Bulk transactions deleted");
}

export async function bulkUpdate(input: BulkUpdateInput, ctx: ActionContext) {
  const data: Record<string, unknown> = { updatedById: ctx.userId };
  if (input.patch.isPending !== undefined) data.isPending = input.patch.isPending;
  if (input.patch.isFavorite !== undefined) data.isFavorite = input.patch.isFavorite;
  if (input.patch.categoryId !== undefined) data.categoryId = input.patch.categoryId ?? null;
  if (input.patch.institutionId !== undefined) data.institutionId = input.patch.institutionId ?? null;

  await prisma.transaction.updateMany({
    where: { id: { in: input.ids }, accountId: ctx.accountId },
    data,
  });
  log.info({ count: input.ids.length, accountId: ctx.accountId }, "Bulk transactions updated");
}

export async function moveTransactions(
  input: MoveTransactionsInput,
  ctx: ActionContext,
): Promise<{ targetTableId: string; targetTableName: string; targetMonthId: string }> {
  const { destination } = input;

  if (destination.type === "existing") {
    const targetTable = await getTableOrThrow(destination.tableId, ctx.accountId);
    await prisma.transaction.updateMany({
      where: { id: { in: input.ids }, accountId: ctx.accountId },
      data: {
        tableId: destination.tableId,
        sectionId: targetTable.sectionId,
        monthId: targetTable.monthId,
        updatedById: ctx.userId,
      },
    });
    const full = await prisma.financeTable.findUnique({
      where: { id: destination.tableId },
      select: { name: true },
    });
    log.info({ count: input.ids.length, targetTableId: destination.tableId }, "Transactions moved to existing table");
    return { targetTableId: destination.tableId, targetTableName: full?.name ?? "", targetMonthId: targetTable.monthId };
  }

  // type === "new" — verify month, section, tableType belong to this account
  const [month, section, tableType] = await Promise.all([
    prisma.month.findFirst({ where: { id: destination.monthId, accountId: ctx.accountId } }),
    prisma.section.findFirst({ where: { id: destination.sectionId, accountId: ctx.accountId, isActive: true } }),
    prisma.tableType.findFirst({ where: { id: destination.tableTypeId, accountId: ctx.accountId } }),
  ]);
  if (!month) throw new NotFoundError("Mês");
  if (!section) throw new NotFoundError("Seção");
  if (!tableType) throw new NotFoundError("Tipo de tabela");

  const result = await prisma.$transaction(async (tx) => {
    const tableCount = await tx.financeTable.count({
      where: { monthId: destination.monthId, sectionId: destination.sectionId },
    });
    const newTable = await tx.financeTable.create({
      data: {
        accountId: ctx.accountId,
        monthId: destination.monthId,
        sectionId: destination.sectionId,
        tableTypeId: destination.tableTypeId,
        name: destination.name,
        countInMonth: destination.countInMonth,
        sourceMethod: "empty",
        displayOrder: tableCount,
        createdById: ctx.userId,
      },
    });
    await tx.transaction.updateMany({
      where: { id: { in: input.ids }, accountId: ctx.accountId },
      data: {
        tableId: newTable.id,
        sectionId: destination.sectionId,
        monthId: destination.monthId,
        updatedById: ctx.userId,
      },
    });
    return newTable;
  });

  log.info({ count: input.ids.length, newTableId: result.id }, "Transactions moved to new table");
  return { targetTableId: result.id, targetTableName: result.name, targetMonthId: destination.monthId };
}

export async function listTablesForMove(accountId: string) {
  const [months, sections, tables, tableTypes] = await Promise.all([
    prisma.month.findMany({
      where: { accountId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, year: true, month: true },
    }),
    prisma.section.findMany({
      where: { accountId, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.financeTable.findMany({
      where: { accountId },
      select: { id: true, name: true, monthId: true, sectionId: true },
    }),
    prisma.tableType.findMany({
      where: { accountId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
  ]);

  return {
    months: months.map((m) => ({ ...m, label: formatMonthLabel(m.year, m.month) })),
    sections,
    tables,
    tableTypes,
  };
}

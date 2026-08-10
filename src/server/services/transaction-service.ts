import type { Prisma, SectionCountType } from "@prisma/client";

import { formatMonthLabel } from "@/lib/dates";
import { moveInvertsConvention } from "@/lib/money";
import type {
  BulkDeleteInput,
  BulkUpdateInput,
  CreateTransactionInput,
  DeleteTransactionInput,
  DuplicateTransactionInput,
  MoveTransactionsInput,
  UpdateTransactionInput,
} from "@/lib/schemas/transaction";
import type { ActionContext } from "@/server/api/define-action";
import { NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import * as notificationService from "@/server/services/notification-service";

import * as installmentService from "./installment-service";
import { touchLastUsed, type UsageTouch } from "./settings-usage-touch";

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
      responsiblePartyId: input.responsiblePartyId ?? null,
      cardInstallment: input.cardInstallment ?? null,
      investmentType: input.investmentType ?? null,
      expenseType: input.expenseType ?? null,
      paymentMethod: input.paymentMethod ?? null,
      originalAmountCents: input.originalAmountCents ?? null,
      originalCurrency: input.originalCurrency ?? null,
      exchangeRate: input.exchangeRate ?? null,
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

  // Spec 67 §2.4 (SET-07): `lastUsedAt` é gravado na escrita que consome o
  // objeto, nunca calculado na leitura. Fire-and-forget e fora de qualquer
  // transação — telemetria de uso não pode derrubar a criação da transação.
  // Ids nulos são descartados pelo próprio helper.
  void touchLastUsed(ctx.accountId, {
    category: [input.categoryId],
    subcategory: [input.subcategoryId],
    institution: [input.institutionId],
    responsibleParty: [input.responsiblePartyId],
  });

  log.info({ transactionId: transaction.id, tableId: input.tableId }, "Transaction created");
  return { transactionId: transaction.id, monthId: table.monthId };
}

export async function updateTransaction(
  input: UpdateTransactionInput,
  ctx: ActionContext,
): Promise<{ monthId: string }> {
  const tx = await getTransactionOrThrow(input.transactionId, ctx.accountId);

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
  if (input.responsiblePartyId !== undefined)
    data.responsiblePartyId = input.responsiblePartyId ?? null;
  if (input.cardInstallment !== undefined) data.cardInstallment = input.cardInstallment ?? null;
  if (input.investmentType !== undefined) data.investmentType = input.investmentType ?? null;
  if (input.expenseType !== undefined) data.expenseType = input.expenseType ?? null;
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod ?? null;
  if (input.originalAmountCents !== undefined)
    data.originalAmountCents = input.originalAmountCents ?? null;
  if (input.originalCurrency !== undefined) data.originalCurrency = input.originalCurrency ?? null;
  if (input.exchangeRate !== undefined) data.exchangeRate = input.exchangeRate ?? null;

  await prisma.transaction.update({ where: { id: input.transactionId }, data });

  // Spec 67 §2.4 (SET-07): o patch é PARCIAL — só toca as entidades cujo campo
  // veio no patch. Tocar um id que não mudou seria mentira sobre o uso: o
  // objeto continua referenciado, mas ninguém o escolheu agora.
  const touch: UsageTouch = {};
  if (input.categoryId !== undefined) touch.category = [input.categoryId];
  if (input.subcategoryId !== undefined) touch.subcategory = [input.subcategoryId];
  if (input.institutionId !== undefined) touch.institution = [input.institutionId];
  if (input.responsiblePartyId !== undefined) touch.responsibleParty = [input.responsiblePartyId];
  void touchLastUsed(ctx.accountId, touch);

  log.info({ transactionId: input.transactionId }, "Transaction updated");
  return { monthId: tx.monthId };
}

export async function deleteTransaction(
  input: DeleteTransactionInput,
  ctx: ActionContext,
): Promise<{ monthId: string }> {
  // Busca completa antes de deletar para preservar dados de parcelamento
  const tx = await prisma.transaction.findUnique({
    where: { id: input.transactionId },
    select: {
      accountId: true,
      monthId: true,
      installmentGroupId: true,
      installmentNumber: true,
      amountCents: true,
      occurredOn: true,
      description: true,
      categoryId: true,
      subcategoryId: true,
      notes: true,
    },
  });
  if (!tx || tx.accountId !== ctx.accountId) throw new NotFoundError("Transação");

  await prisma.transaction.delete({ where: { id: input.transactionId } });

  // Se faz parte de um grupo de parcelamento, restaurar como PendingInstallment
  if (tx.installmentGroupId && tx.installmentNumber) {
    await installmentService.restoreAsPendingInstallment({
      accountId: ctx.accountId,
      installmentGroupId: tx.installmentGroupId,
      installmentNumber: tx.installmentNumber,
      amountCents: tx.amountCents,
      occurredOn: tx.occurredOn,
      description: tx.description,
      categoryId: tx.categoryId,
      subcategoryId: tx.subcategoryId,
      notes: tx.notes,
    });
  }

  void notificationService.notifyTransactionMutation({
    accountId: ctx.accountId,
    actorId: ctx.userId,
    type: "transaction_deleted",
    monthId: tx.monthId,
  });

  // Spec 67 §2.4 (SET-07): NÃO toca `lastUsedAt`. Apagar não é usar — marcar a
  // categoria como "usada em ago/2026" porque alguém apagou a transação que a
  // referenciava inverteria o sentido do rótulo. Intencional: não "completar".

  log.info({ transactionId: input.transactionId }, "Transaction deleted");
  return { monthId: tx.monthId };
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
      responsiblePartyId: source.responsiblePartyId,
      cardInstallment: source.cardInstallment,
      investmentType: source.investmentType,
      expenseType: source.expenseType,
      paymentMethod: source.paymentMethod,
      source: "duplicate",
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

  // Spec 67 §2.4 (SET-07): a cópia grava os mesmos ids da origem — é uma nova
  // escrita que consome esses objetos, então conta como uso (mesmo critério do
  // create). Fire-and-forget, fora de transação.
  void touchLastUsed(ctx.accountId, {
    category: [source.categoryId],
    subcategory: [source.subcategoryId],
    institution: [source.institutionId],
    responsibleParty: [source.responsiblePartyId],
  });

  log.info({ sourceId: input.transactionId, newId: newTx.id }, "Transaction duplicated");
  return { transactionId: newTx.id, monthId: source.monthId };
}

export async function bulkDelete(
  input: BulkDeleteInput,
  ctx: ActionContext,
): Promise<{ uniqueMonthIds: string[] }> {
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

  // Spec 67 §2.4 (SET-07): NÃO toca `lastUsedAt` — mesmo motivo do
  // `deleteTransaction`. Apagar em massa não é usar em massa. Intencional.

  log.info({ count: input.ids.length, accountId: ctx.accountId }, "Bulk transactions deleted");
  return { uniqueMonthIds };
}

export async function bulkUpdate(input: BulkUpdateInput, ctx: ActionContext) {
  const data: Record<string, unknown> = { updatedById: ctx.userId };
  if (input.patch.isPending !== undefined) data.isPending = input.patch.isPending;
  if (input.patch.isFavorite !== undefined) data.isFavorite = input.patch.isFavorite;
  if (input.patch.categoryId !== undefined) data.categoryId = input.patch.categoryId ?? null;
  if (input.patch.institutionId !== undefined)
    data.institutionId = input.patch.institutionId ?? null;
  if (input.patch.expenseType !== undefined) data.expenseType = input.patch.expenseType ?? null;
  if (input.patch.paymentMethod !== undefined)
    data.paymentMethod = input.patch.paymentMethod ?? null;

  await prisma.transaction.updateMany({
    where: { id: { in: input.ids }, accountId: ctx.accountId },
    data,
  });

  // Spec 67 §2.4 (SET-07): igual ao update individual — só o que o patch em
  // massa realmente gravou. `bulkUpdate` não mexe em subcategoria nem em
  // responsável, então essas duas nunca são tocadas aqui.
  const touch: UsageTouch = {};
  if (input.patch.categoryId !== undefined) touch.category = [input.patch.categoryId];
  if (input.patch.institutionId !== undefined) touch.institution = [input.patch.institutionId];
  void touchLastUsed(ctx.accountId, touch);

  log.info({ count: input.ids.length, accountId: ctx.accountId }, "Bulk transactions updated");
}

/**
 * Aplica a movimentação (troca de tabela/seção/mês) e, quando `invertSign`
 * está ativo, nega `amountCents` das transações cuja convenção de exibição de
 * origem difere da do destino (ver spec 59). Toda a matemática é BigInt e todos
 * os updates são restritos por `accountId` (multi-tenancy).
 */
async function applyMove(
  client: Prisma.TransactionClient,
  params: {
    ids: string[];
    accountId: string;
    userId: string;
    moveData: { tableId: string; sectionId: string; monthId: string };
    destCountType: SectionCountType;
    invertSign: boolean;
  },
): Promise<void> {
  const { ids, accountId, userId, moveData, destCountType, invertSign } = params;
  const data = { ...moveData, updatedById: userId };

  if (!invertSign) {
    await client.transaction.updateMany({ where: { id: { in: ids }, accountId }, data });
    return;
  }

  const txs = await client.transaction.findMany({
    where: { id: { in: ids }, accountId },
    select: { id: true, section: { select: { countType: true } } },
  });

  const flipIds: string[] = [];
  const keepIds: string[] = [];
  for (const tx of txs) {
    if (moveInvertsConvention(tx.section.countType, destCountType)) flipIds.push(tx.id);
    else keepIds.push(tx.id);
  }

  if (keepIds.length > 0) {
    await client.transaction.updateMany({ where: { id: { in: keepIds }, accountId }, data });
  }
  if (flipIds.length > 0) {
    await client.transaction.updateMany({
      where: { id: { in: flipIds }, accountId },
      data: { ...data, amountCents: { multiply: -1 } },
    });
  }
}

export async function moveTransactions(
  input: MoveTransactionsInput,
  ctx: ActionContext,
): Promise<{ targetTableId: string; targetTableName: string; targetMonthId: string }> {
  const { destination } = input;

  if (destination.type === "existing") {
    const targetTable = await getTableOrThrow(destination.tableId, ctx.accountId);
    const targetSection = await prisma.section.findUnique({
      where: { id: targetTable.sectionId },
      select: { countType: true },
    });
    if (!targetSection) throw new NotFoundError("Seção");

    // Atômico: findMany + updateMany(s) de keep/flip devem ser tudo-ou-nada
    await prisma.$transaction((tx) =>
      applyMove(tx, {
        ids: input.ids,
        accountId: ctx.accountId,
        userId: ctx.userId,
        moveData: {
          tableId: destination.tableId,
          sectionId: targetTable.sectionId,
          monthId: targetTable.monthId,
        },
        destCountType: targetSection.countType,
        invertSign: input.invertSign,
      }),
    );

    // Spec 67 §2.4 (SET-07): mover consome a seção de DESTINO (a de origem
    // deixou de ser usada, não passou a ser). Fora da `$transaction`, depois do
    // commit — telemetria não pode fazer o move inteiro dar rollback.
    void touchLastUsed(ctx.accountId, { section: [targetTable.sectionId] });

    const full = await prisma.financeTable.findUnique({
      where: { id: destination.tableId },
      select: { name: true },
    });
    log.info(
      { count: input.ids.length, targetTableId: destination.tableId },
      "Transactions moved to existing table",
    );
    return {
      targetTableId: destination.tableId,
      targetTableName: full?.name ?? "",
      targetMonthId: targetTable.monthId,
    };
  }

  // type === "new" — verify month, section, tableType belong to this account
  const [month, section, tableType] = await Promise.all([
    prisma.month.findFirst({ where: { id: destination.monthId, accountId: ctx.accountId } }),
    prisma.section.findFirst({
      where: { id: destination.sectionId, accountId: ctx.accountId, isActive: true },
    }),
    prisma.tableType.findFirst({
      where: { id: destination.tableTypeId, accountId: ctx.accountId },
    }),
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
    await applyMove(tx, {
      ids: input.ids,
      accountId: ctx.accountId,
      userId: ctx.userId,
      moveData: {
        tableId: newTable.id,
        sectionId: destination.sectionId,
        monthId: destination.monthId,
      },
      destCountType: section.countType,
      invertSign: input.invertSign,
    });
    return newTable;
  });

  // Spec 67 §2.4 (SET-07): mesma regra do ramo "existing" — a seção de destino
  // foi consumida. Fora da `$transaction`, depois do commit.
  void touchLastUsed(ctx.accountId, { section: [destination.sectionId] });

  log.info({ count: input.ids.length, newTableId: result.id }, "Transactions moved to new table");
  return {
    targetTableId: result.id,
    targetTableName: result.name,
    targetMonthId: destination.monthId,
  };
}

export async function listTablesForMove(accountId: string) {
  const [months, sections, tables, tableTypes, settings] = await Promise.all([
    prisma.month.findMany({
      where: { accountId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, year: true, month: true },
    }),
    prisma.section.findMany({
      where: { accountId, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, countType: true },
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
    prisma.accountSettings.findUnique({
      where: { accountId },
      select: { invertSignOnMoveByDefault: true },
    }),
  ]);

  return {
    months: months.map((m) => ({ ...m, label: formatMonthLabel(m.year, m.month) })),
    sections,
    tables,
    tableTypes,
    invertSignOnMoveByDefault: settings?.invertSignOnMoveByDefault ?? true,
  };
}

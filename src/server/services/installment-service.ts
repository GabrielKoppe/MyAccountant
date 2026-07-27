import { addMonths } from "date-fns";

import { ConflictError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { calcInstallmentAmounts } from "@/lib/installment-utils";
import type {
  CreateInstallmentGroupInput,
  SettleInstallmentGroupInput,
  UndoInstallmentGroupInput,
} from "@/lib/schemas/installment";

export { calcInstallmentAmounts } from "@/lib/installment-utils";

const log = logger.child({ module: "installment-service" });

// ─── createInstallmentGroup ────────────────────────────────────────────────────

export async function createInstallmentGroup(
  input: CreateInstallmentGroupInput,
  ctx: ActionContext,
): Promise<{
  installmentGroupId: string;
  firstTransactionId: string;
  convertedImmediately: number;
}> {
  // Buscar tabela com todos os dados necessários (sectionId e tableTypeId são derivados daqui)
  const table = await prisma.financeTable.findUnique({
    where: { id: input.tableId },
    select: {
      id: true,
      accountId: true,
      monthId: true,
      sectionId: true,
      tableTypeId: true,
    },
  });
  if (!table || table.accountId !== ctx.accountId) throw new NotFoundError("Tabela");

  const amounts = calcInstallmentAmounts(
    input.totalCents,
    input.installmentCount,
    input.downPaymentCents,
  );

  // Calcular datas esperadas de cada parcela futura (2..N)
  const pendingDates = Array.from({ length: input.installmentCount - 1 }, (_, i) =>
    addMonths(input.startDate, i + 1),
  );

  const result = await prisma.$transaction(async (tx) => {
    // Criar o grupo — seção e tipo derivados da tabela atual
    const group = await tx.installmentGroup.create({
      data: {
        accountId: ctx.accountId,
        description: input.description,
        totalCents: input.totalCents,
        installmentCount: input.installmentCount,
        downPaymentCents: input.downPaymentCents ?? null,
        startDate: input.startDate,
        sectionId: table.sectionId,
        tableTypeId: table.tableTypeId ?? null,
      },
      select: { id: true },
    });

    // Parcela 1 como Transaction nesta tabela
    const firstTx = await tx.transaction.create({
      data: {
        accountId: ctx.accountId,
        monthId: table.monthId,
        tableId: table.id,
        sectionId: table.sectionId,
        occurredOn: input.startDate,
        amountCents: amounts[0],
        description: input.description,
        isPending: false,
        isFavorite: false,
        source: "manual",
        metadata: {},
        installmentGroupId: group.id,
        installmentNumber: 1,
        createdById: ctx.userId,
      },
      select: { id: true },
    });

    // Parcelas 2–N como PendingInstallment
    if (input.installmentCount > 1) {
      await tx.pendingInstallment.createMany({
        data: pendingDates.map((expectedDate, i) => ({
          accountId: ctx.accountId,
          installmentGroupId: group.id,
          installmentNumber: i + 2,
          amountCents: amounts[i + 1],
          expectedDate,
          description: input.description,
        })),
      });
    }

    return { groupId: group.id, firstTxId: firstTx.id };
  });

  log.info(
    { groupId: result.groupId, installmentCount: input.installmentCount, accountId: ctx.accountId },
    "InstallmentGroup created",
  );

  // ─── Converter imediatamente meses que já existem ────────────────────────────
  // Se julho e agosto já foram criados antes deste parcelamento, as parcelas
  // que caem nesses meses devem ser convertidas agora (não só ao criar o mês).
  let convertedImmediately = 0;
  if (pendingDates.length > 0) {
    // Deduplica por (year, month) para não processar o mesmo mês duas vezes
    const uniqueMonthKeys = new Map<string, { year: number; month: number }>();
    for (const d of pendingDates) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      uniqueMonthKeys.set(`${y}-${m}`, { year: y, month: m });
    }

    const existingMonths = await prisma.month.findMany({
      where: {
        accountId: ctx.accountId,
        OR: Array.from(uniqueMonthKeys.values()).map((p) => ({ year: p.year, month: p.month })),
      },
      select: { id: true, year: true, month: true },
    });

    for (const em of existingMonths) {
      const r = await convertPendingInstallmentsForMonth(
        ctx.accountId,
        em.id,
        em.year,
        em.month,
        ctx.userId,
      );
      convertedImmediately += r.converted;
    }
  }

  return {
    installmentGroupId: result.groupId,
    firstTransactionId: result.firstTxId,
    convertedImmediately,
  };
}

// ─── convertPendingInstallmentsForMonth ───────────────────────────────────────

export type InstallmentConvertResult = {
  converted: number;
  failed: { groupDescription: string; reason: string }[];
};

/**
 * Converte PendingInstallments cujo expectedDate cai no mês (year/month) em Transactions.
 * A tabela de destino usa sectionId + tableTypeId do InstallmentGroup (derivados da tabela original).
 * Chamado: (1) ao criar mês via month-service; (2) imediatamente ao criar o grupo se o mês já existe.
 */
export async function convertPendingInstallmentsForMonth(
  accountId: string,
  monthId: string,
  year: number,
  month: number,
  createdById: string,
): Promise<InstallmentConvertResult> {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);

  const pending = await prisma.pendingInstallment.findMany({
    where: { accountId, expectedDate: { gte: from, lte: to } },
    include: {
      group: {
        select: {
          id: true,
          description: true,
          sectionId: true,
          tableTypeId: true,
          installmentCount: true,
        },
      },
    },
  });

  if (pending.length === 0) return { converted: 0, failed: [] };

  let converted = 0;
  const failed: InstallmentConvertResult["failed"] = [];

  for (const pi of pending) {
    try {
      const section = await prisma.section.findFirst({
        where: { id: pi.group.sectionId, accountId, isActive: true },
        select: { id: true },
      });
      if (!section) throw new Error("Seção destino do grupo não encontrada ou inativa.");

      await prisma.$transaction(async (tx) => {
        let table = await tx.financeTable.findFirst({
          where: {
            accountId,
            monthId,
            sectionId: pi.group.sectionId,
            ...(pi.group.tableTypeId ? { tableTypeId: pi.group.tableTypeId } : {}),
          },
          select: { id: true, sectionId: true },
        });

        if (!table) {
          const tableTypeName = pi.group.tableTypeId
            ? ((
                await tx.tableType.findUnique({
                  where: { id: pi.group.tableTypeId },
                  select: { name: true },
                })
              )?.name ?? "Tabela")
            : "Tabela";

          const tableCount = await tx.financeTable.count({
            where: { accountId, monthId, sectionId: pi.group.sectionId },
          });

          table = await tx.financeTable.create({
            data: {
              accountId,
              monthId,
              sectionId: pi.group.sectionId,
              tableTypeId: pi.group.tableTypeId ?? null,
              name: tableTypeName,
              countInMonth: true,
              sourceMethod: "empty",
              displayOrder: tableCount,
              createdById,
            },
            select: { id: true, sectionId: true },
          });
        }

        await tx.transaction.create({
          data: {
            accountId,
            monthId,
            tableId: table.id,
            sectionId: table.sectionId,
            occurredOn: pi.expectedDate,
            amountCents: pi.amountCents,
            description: pi.description ?? pi.group.description,
            notes: pi.notes ?? null,
            categoryId: pi.categoryId ?? null,
            subcategoryId: pi.subcategoryId ?? null,
            isPending: false,
            isFavorite: false,
            source: "auto_template",
            metadata: {},
            installmentGroupId: pi.group.id,
            installmentNumber: pi.installmentNumber,
            createdById,
          },
        });

        await tx.pendingInstallment.delete({ where: { id: pi.id } });
      });

      converted++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Erro desconhecido";
      log.warn({ pendingInstallmentId: pi.id, reason }, "Failed to convert pending installment");
      failed.push({ groupDescription: pi.group.description, reason });
    }
  }

  log.info({ converted, failed: failed.length, accountId }, "Pending installments converted");
  return { converted, failed };
}

// ─── restoreAsPendingInstallment ──────────────────────────────────────────────

export type RestoreInstallmentData = {
  accountId: string;
  installmentGroupId: string;
  installmentNumber: number;
  amountCents: bigint;
  /** Data que a transação tinha como occurredOn — vira expectedDate do PendingInstallment */
  occurredOn: Date;
  description: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  notes: string | null;
};

/**
 * Restaura uma Transaction deletada como PendingInstallment, preservando campos editados.
 * Idempotente: não cria duplicata se já existe um PendingInstallment para o mesmo installmentNumber.
 * Chamado automaticamente por transaction-service.deleteTransaction quando há installmentGroupId.
 */
export async function restoreAsPendingInstallment(data: RestoreInstallmentData): Promise<void> {
  // Idempotência: não criar duplicata
  const existing = await prisma.pendingInstallment.findFirst({
    where: {
      installmentGroupId: data.installmentGroupId,
      installmentNumber: data.installmentNumber,
    },
    select: { id: true },
  });

  if (existing) {
    log.warn(
      { installmentGroupId: data.installmentGroupId, installmentNumber: data.installmentNumber },
      "PendingInstallment já existe para este número — restore ignorado",
    );
    return;
  }

  await prisma.pendingInstallment.create({
    data: {
      accountId: data.accountId,
      installmentGroupId: data.installmentGroupId,
      installmentNumber: data.installmentNumber,
      amountCents: data.amountCents,
      expectedDate: data.occurredOn,
      description: data.description,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
      notes: data.notes,
    },
  });

  log.info(
    { installmentGroupId: data.installmentGroupId, installmentNumber: data.installmentNumber },
    "Transaction restaurada como PendingInstallment",
  );
}

// ─── getInstallmentGroupPanelData ─────────────────────────────────────────────

export type InstallmentPanelItem = {
  installmentNumber: number;
  amountCents: string;
  date: string; // ISO "YYYY-MM-DD"
  status: "paid" | "pending" | "waiting";
  transactionId?: string;
  monthYear?: number;
  monthMonth?: number;
  /** Apenas para itens waiting: ID do PendingInstallment */
  pendingInstallmentId?: string;
  /** Apenas para itens waiting: ID do mês se ele já existir (mas a parcela ainda não foi criada) */
  existingMonthId?: string;
};

export type InstallmentGroupPanelData = {
  id: string;
  description: string;
  totalCents: string;
  installmentCount: number;
  items: InstallmentPanelItem[];
};

/**
 * Busca todos os dados do painel de grupo de parcelamento:
 * grupo + transações vinculadas + parcelas pendentes.
 */
export async function getInstallmentGroupPanelData(
  installmentGroupId: string,
  accountId: string,
): Promise<InstallmentGroupPanelData | null> {
  const group = await prisma.installmentGroup.findUnique({
    where: { id: installmentGroupId, accountId },
    select: {
      id: true,
      description: true,
      totalCents: true,
      installmentCount: true,
      transactions: {
        select: {
          id: true,
          installmentNumber: true,
          amountCents: true,
          occurredOn: true,
          isPending: true,
          month: { select: { year: true, month: true } },
        },
        orderBy: { installmentNumber: "asc" },
      },
      pendingInstallments: {
        select: {
          id: true,
          installmentNumber: true,
          amountCents: true,
          expectedDate: true,
        },
        orderBy: { installmentNumber: "asc" },
      },
    },
  });

  if (!group) return null;

  // Verificar quais meses já existem (para detectar "waiting" com mês criado)
  const existingMonths = await prisma.month.findMany({
    where: { accountId },
    select: { id: true, year: true, month: true },
  });

  const items: InstallmentPanelItem[] = [
    ...group.transactions.map((tx) => ({
      installmentNumber: tx.installmentNumber ?? 0,
      amountCents: tx.amountCents.toString(),
      date: tx.occurredOn.toISOString().slice(0, 10),
      status: (tx.isPending ? "pending" : "paid") as "paid" | "pending",
      transactionId: tx.id,
      monthYear: tx.month.year,
      monthMonth: tx.month.month,
    })),
    ...group.pendingInstallments.map((pi) => {
      const piYear = pi.expectedDate.getFullYear();
      const piMonth = pi.expectedDate.getMonth() + 1;
      const existingMonth = existingMonths.find((em) => em.year === piYear && em.month === piMonth);
      return {
        installmentNumber: pi.installmentNumber,
        amountCents: pi.amountCents.toString(),
        date: pi.expectedDate.toISOString().slice(0, 10),
        status: "waiting" as const,
        pendingInstallmentId: pi.id,
        existingMonthId: existingMonth?.id,
      };
    }),
  ].sort((a, b) => a.installmentNumber - b.installmentNumber);

  return {
    id: group.id,
    description: group.description,
    totalCents: group.totalCents.toString(),
    installmentCount: group.installmentCount,
    items,
  };
}

// ─── settleInstallmentGroup ───────────────────────────────────────────────────

export type SettleResult = {
  mode: "individual" | "consolidated";
  settledCount: number;
};

/**
 * Quita antecipadamente um grupo de parcelamento.
 * - individual: cada PendingInstallment vira uma Transaction separada.
 * - consolidated: uma única Transaction com o valor total das parcelas restantes.
 */
export async function settleInstallmentGroup(
  input: SettleInstallmentGroupInput,
  ctx: ActionContext,
): Promise<SettleResult> {
  const group = await prisma.installmentGroup.findUnique({
    where: { id: input.installmentGroupId, accountId: ctx.accountId },
    select: { id: true, description: true },
  });
  if (!group) throw new NotFoundError("Grupo de parcelamento");

  const pending = await prisma.pendingInstallment.findMany({
    where: { installmentGroupId: input.installmentGroupId, accountId: ctx.accountId },
    orderBy: { installmentNumber: "asc" },
  });

  if (pending.length === 0) {
    throw new ConflictError("Não há parcelas pendentes para quitar.");
  }

  // Limitar ao número solicitado (parcelas ordenadas por número de parcela)
  const pendingToSettle = pending.slice(0, input.count);
  const isPartial = pendingToSettle.length < pending.length;

  const table = await prisma.financeTable.findUnique({
    where: { id: input.tableId },
    select: { id: true, accountId: true, monthId: true, sectionId: true },
  });
  if (!table || table.accountId !== ctx.accountId) throw new NotFoundError("Tabela de destino");

  // Data de hoje sem hora (Date-only)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (input.mode === "individual") {
    await prisma.$transaction(async (tx) => {
      for (const pi of pendingToSettle) {
        await tx.transaction.create({
          data: {
            accountId: ctx.accountId,
            monthId: table.monthId,
            tableId: table.id,
            sectionId: table.sectionId,
            occurredOn: today,
            amountCents: pi.amountCents,
            description: pi.description ?? group.description,
            categoryId: pi.categoryId ?? null,
            subcategoryId: pi.subcategoryId ?? null,
            notes: pi.notes ?? null,
            isPending: false,
            isFavorite: false,
            source: "manual",
            metadata: {},
            installmentGroupId: input.installmentGroupId,
            installmentNumber: pi.installmentNumber,
            createdById: ctx.userId,
          },
        });
        await tx.pendingInstallment.delete({ where: { id: pi.id } });
      }
    });

    log.info(
      { groupId: input.installmentGroupId, count: pendingToSettle.length, isPartial },
      "Settled individually",
    );
    return { mode: "individual", settledCount: pendingToSettle.length };
  }

  // consolidated
  const totalCents = pendingToSettle.reduce((sum, pi) => sum + pi.amountCents, 0n);
  const description = isPartial
    ? `Amortização antecipada — ${group.description}`
    : `Quitação antecipada — ${group.description}`;

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        accountId: ctx.accountId,
        monthId: table.monthId,
        tableId: table.id,
        sectionId: table.sectionId,
        occurredOn: today,
        amountCents: totalCents,
        description,
        isPending: false,
        isFavorite: false,
        source: "manual",
        metadata: {},
        createdById: ctx.userId,
      },
    });
    // Deletar apenas as parcelas quitadas (não todas)
    await tx.pendingInstallment.deleteMany({
      where: { id: { in: pendingToSettle.map((p) => p.id) } },
    });
  });

  log.info({ groupId: input.installmentGroupId, totalCents, isPartial }, "Settled consolidated");
  return { mode: "consolidated", settledCount: 1 };
}

// ─── undoInstallmentGroup ──────────────────────────────────────────────────────

export type UndoInstallmentGroupResult = {
  dissociatedTransactions: number;
  deletedPending: number;
};

/**
 * Desfaz um grupo de parcelamento. Semântica NÃO-DESTRUTIVA (spec 66 §10.5, opção A):
 * as transações já lançadas são desvinculadas (viram transações normais, preservando
 * valor/data/descrição), as PendingInstallment futuras são removidas e o grupo é
 * apagado. Alinhado ao FK `onDelete: SetNull` já existente no schema.
 */
export async function undoInstallmentGroup(
  input: UndoInstallmentGroupInput,
  ctx: ActionContext,
): Promise<UndoInstallmentGroupResult> {
  const group = await prisma.installmentGroup.findUnique({
    where: { id: input.installmentGroupId, accountId: ctx.accountId },
    select: { id: true },
  });
  if (!group) throw new NotFoundError("Grupo de parcelamento");

  const result = await prisma.$transaction(async (tx) => {
    const dissociated = await tx.transaction.updateMany({
      where: { installmentGroupId: input.installmentGroupId, accountId: ctx.accountId },
      data: { installmentGroupId: null, installmentNumber: null },
    });

    const deletedPending = await tx.pendingInstallment.deleteMany({
      where: { installmentGroupId: input.installmentGroupId, accountId: ctx.accountId },
    });

    await tx.installmentGroup.delete({ where: { id: input.installmentGroupId } });

    return {
      dissociatedTransactions: dissociated.count,
      deletedPending: deletedPending.count,
    };
  });

  log.info(
    { groupId: input.installmentGroupId, accountId: ctx.accountId, ...result },
    "InstallmentGroup undone (non-destructive)",
  );

  return result;
}

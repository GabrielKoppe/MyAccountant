"use server";

import { defineAction } from "@/server/api/define-action";
import { z } from "zod";
import { cuidSchema } from "@/lib/schemas/shared";
import {
  createInstallmentGroupSchema,
  setInstallmentGroupAutoCreateSchema,
  setPendingInstallmentSettledSchema,
  settleInstallmentGroupSchema,
  undoInstallmentGroupSchema,
} from "@/lib/schemas/installment";
import * as installmentService from "@/server/services/installment-service";
import { prisma } from "@/server/prisma";
import { requireAccountAccess } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/api/errors";
import { utcYearMonthOf } from "@/lib/dates";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createInstallmentGroupAction = defineAction({
  schema: createInstallmentGroupSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    return installmentService.createInstallmentGroup(input, ctx);
  },
});

/**
 * Retorna o contexto necessário para o dialog de criação de parcelamento:
 * ano/mês da tabela (para mostrar aviso se a data escolhida for de outro mês),
 * e nomes de seção e tipo de tabela (para mostrar onde as parcelas futuras serão criadas).
 */
export async function getInstallmentCreateContext(accountId: string, tableId: string) {
  await requireAccountAccess(accountId);

  const table = await prisma.financeTable.findUnique({
    where: { id: tableId, accountId },
    select: {
      month: { select: { year: true, month: true } },
      section: { select: { name: true } },
      tableType: { select: { name: true } },
    },
  });
  if (!table) return null;

  return {
    year: table.month.year,
    month: table.month.month,
    sectionName: table.section.name,
    tableTypeName: table.tableType?.name ?? null,
  };
}

/** Busca todos os dados do painel de grupo de parcelamento.
 *  Disponível para todos os papéis (viewers também podem visualizar). */
export const getInstallmentGroupPanelDataAction = defineAction({
  schema: z.object({ installmentGroupId: cuidSchema }),
  handler: async (input, ctx) => {
    return installmentService.getInstallmentGroupPanelData(input.installmentGroupId, ctx.accountId);
  },
});

/** Quita antecipadamente um grupo de parcelamento (owner/editor apenas). */
export const settleInstallmentGroupAction = defineAction({
  schema: settleInstallmentGroupSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    return installmentService.settleInstallmentGroup(input, ctx);
  },
});

/** Desfaz um grupo de parcelamento (não-destrutivo): desvincula as transações já
 *  lançadas, remove as parcelas pendentes futuras e apaga o grupo (owner/editor apenas). */
export const undoInstallmentGroupAction = defineAction({
  schema: undoInstallmentGroupSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    return installmentService.undoInstallmentGroup(input, ctx);
  },
});

/** Retorna meses, seções e tabelas para o seletor cascata do dialog de quitação antecipada. */
export async function listTablesForSettlementAction(accountId: string) {
  await requireAccountAccess(accountId);

  const [months, sections, tables] = await Promise.all([
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
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, monthId: true, sectionId: true },
    }),
  ]);

  const { formatMonthLabel } = await import("@/lib/dates");
  return {
    months: months.map((mo) => ({ ...mo, label: formatMonthLabel(mo.year, mo.month) })),
    sections,
    tables,
  };
}

/**
 * Converte um PendingInstallment específico para Transaction, usando o mês que
 * já existe para a data prevista. Chamado pelo painel quando o usuário clica em
 * "Criar neste mês" para uma parcela cujo mês já foi aberto mas a transação foi
 * deletada antes de ser convertida automaticamente.
 */
export const convertPendingInstallmentForExistingMonthAction = defineAction({
  schema: z.object({ pendingInstallmentId: cuidSchema }),
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const pi = await prisma.pendingInstallment.findFirst({
      where: { id: input.pendingInstallmentId, accountId: ctx.accountId },
      select: { expectedDate: true, settledAt: true },
    });
    if (!pi) throw new NotFoundError("Parcela pendente");
    if (pi.settledAt) throw new ConflictError("Esta parcela já está marcada como paga.");

    // getUTC*: expectedDate é @db.Date (meia-noite UTC) — spec 73 §2.7
    const { year, month } = utcYearMonthOf(pi.expectedDate);

    const existingMonth = await prisma.month.findFirst({
      where: { accountId: ctx.accountId, year, month },
      select: { id: true },
    });
    if (!existingMonth) throw new NotFoundError("Mês não encontrado para esta data");

    return installmentService.convertPendingInstallmentsForMonth(
      ctx.accountId,
      existingMonth.id,
      year,
      month,
      ctx.userId,
      // Escopo na parcela clicada: sem isso, converteria TODAS as pendências
      // que caem nesse mês, de qualquer grupo.
      { pendingInstallmentIds: [input.pendingInstallmentId] },
    );
  },
});

/** Marca/desmarca uma parcela prevista como paga fora do app (owner/editor apenas). */
export const setPendingInstallmentSettledAction = defineAction({
  schema: setPendingInstallmentSettledSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    return installmentService.setPendingInstallmentSettled(input, ctx);
  },
});

/** Liga/desliga a criação automática das parcelas ao abrir mês novo (owner/editor apenas). */
export const setInstallmentGroupAutoCreateAction = defineAction({
  schema: setInstallmentGroupAutoCreateSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    return installmentService.setInstallmentGroupAutoCreate(input, ctx);
  },
});

/**
 * Resolve, para as sugestões detectadas no preview do import, quais já
 * correspondem a um InstallmentGroup existente (spec 73 §2.3). Somente leitura.
 */
export const findInstallmentGroupMatchesForImportAction = defineAction({
  schema: z.object({
    candidates: z
      .array(
        z.object({
          suggestionId: z.string().min(1).max(200),
          normalizedDescription: z.string().max(200),
          installmentCount: z.number().int().min(2).max(360),
          occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
          installmentNumbers: z.array(z.number().int().min(1)).max(360),
        }),
      )
      .max(500),
  }),
  handler: async (input, ctx) => {
    return installmentService.findInstallmentGroupMatchesForImport(input.candidates, ctx.accountId);
  },
});

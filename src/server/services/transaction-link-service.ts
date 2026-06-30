import type { TransactionLinkType } from "@prisma/client";

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateTransactionLinkInput,
  DeleteTransactionLinkInput,
} from "@/lib/schemas/transaction-link";

const log = logger.child({ module: "transaction-link-service" });

export type TransactionLinkItem = {
  id: string;
  type: TransactionLinkType;
  notes: string | null;
  /** outgoing = this tx is source; incoming = this tx is target */
  direction: "outgoing" | "incoming";
  linkedTransaction: {
    id: string;
    description: string | null;
    amountCents: string;
    occurredOn: string;
    monthId: string;
    sectionId: string;
  };
};

export type LinkedTransactionResult = {
  id: string;
  description: string | null;
  amountCents: string;
  occurredOn: string;
};

// ─── createLink ───────────────────────────────────────────────────────────────

export async function createLink(
  input: CreateTransactionLinkInput,
  ctx: ActionContext,
): Promise<{ linkId: string }> {
  if (input.sourceId === input.targetId) {
    throw new ConflictError("Não é possível vincular uma transação a ela mesma.");
  }

  // Validate both transactions belong to this account
  const [source, target] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: input.sourceId, accountId: ctx.accountId },
      select: { id: true },
    }),
    prisma.transaction.findUnique({
      where: { id: input.targetId, accountId: ctx.accountId },
      select: { id: true },
    }),
  ]);

  if (!source) throw new NotFoundError("Transação de origem");
  if (!target) throw new NotFoundError("Transação de destino");

  // Check duplicate link
  const existing = await prisma.transactionLink.findFirst({
    where: {
      accountId: ctx.accountId,
      OR: [
        { sourceId: input.sourceId, targetId: input.targetId },
        { sourceId: input.targetId, targetId: input.sourceId },
      ],
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError("Estas transações já estão vinculadas.");

  const link = await prisma.transactionLink.create({
    data: {
      accountId: ctx.accountId,
      sourceId: input.sourceId,
      targetId: input.targetId,
      type: input.type,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });

  log.info({ linkId: link.id, sourceId: input.sourceId, targetId: input.targetId }, "Link created");
  return { linkId: link.id };
}

// ─── deleteLink ───────────────────────────────────────────────────────────────

export async function deleteLink(
  input: DeleteTransactionLinkInput,
  ctx: ActionContext,
): Promise<void> {
  const link = await prisma.transactionLink.findUnique({
    where: { id: input.linkId },
    select: { id: true, accountId: true },
  });

  if (!link) throw new NotFoundError("Vínculo");
  if (link.accountId !== ctx.accountId) throw new ForbiddenError();

  await prisma.transactionLink.delete({ where: { id: input.linkId } });
  log.info({ linkId: input.linkId }, "Link deleted");
}

// ─── listLinksForTransaction ──────────────────────────────────────────────────

export async function listLinksForTransaction(
  transactionId: string,
  ctx: ActionContext,
): Promise<TransactionLinkItem[]> {
  const links = await prisma.transactionLink.findMany({
    where: {
      accountId: ctx.accountId,
      OR: [{ sourceId: transactionId }, { targetId: transactionId }],
    },
    include: {
      source: {
        select: {
          id: true,
          description: true,
          amountCents: true,
          occurredOn: true,
          monthId: true,
          sectionId: true,
        },
      },
      target: {
        select: {
          id: true,
          description: true,
          amountCents: true,
          occurredOn: true,
          monthId: true,
          sectionId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return links.map((link) => {
    const isSource = link.sourceId === transactionId;
    const other = isSource ? link.target : link.source;
    return {
      id: link.id,
      type: link.type,
      notes: link.notes,
      direction: isSource ? "outgoing" : "incoming",
      linkedTransaction: {
        id: other.id,
        description: other.description,
        amountCents: other.amountCents.toString(),
        occurredOn: other.occurredOn.toISOString().slice(0, 10),
        monthId: other.monthId,
        sectionId: other.sectionId,
      },
    };
  });
}

// ─── searchTransactionsForLink ────────────────────────────────────────────────

export async function searchTransactionsForLink(
  query: string,
  excludeTransactionId: string | undefined,
  tableId: string | undefined,
  ctx: ActionContext,
): Promise<LinkedTransactionResult[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      accountId: ctx.accountId,
      ...(excludeTransactionId ? { NOT: { id: excludeTransactionId } } : {}),
      ...(tableId ? { tableId } : {}),
      ...(query.trim() ? { description: { contains: query.trim(), mode: "insensitive" } } : {}),
    },
    orderBy: { occurredOn: "desc" },
    take: 50,
    select: {
      id: true,
      description: true,
      amountCents: true,
      occurredOn: true,
      monthId: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    amountCents: r.amountCents.toString(),
    occurredOn: r.occurredOn.toISOString().slice(0, 10),
  }));
}

// ─── getMonthsForLink ─────────────────────────────────────────────────────────

export type LinkNavMonth = { id: string; year: number; month: number; label: string };

export async function getMonthsForLink(ctx: ActionContext): Promise<LinkNavMonth[]> {
  const { formatMonthLabel } = await import("@/lib/dates");
  const months = await prisma.month.findMany({
    where: { accountId: ctx.accountId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true, year: true, month: true },
  });
  return months.map((m) => ({ ...m, label: formatMonthLabel(m.year, m.month) }));
}

// ─── getSectionsTablesForLink ─────────────────────────────────────────────────

export type LinkNavTable = { id: string; name: string };
export type LinkNavSection = { id: string; name: string; tables: LinkNavTable[] };

export async function getSectionsTablesForLink(
  monthId: string,
  ctx: ActionContext,
): Promise<LinkNavSection[]> {
  const tables = await prisma.financeTable.findMany({
    where: { accountId: ctx.accountId, monthId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      section: { select: { id: true, name: true } },
    },
  });

  // Group tables by section
  const sectionMap = new Map<string, LinkNavSection>();
  for (const t of tables) {
    if (!sectionMap.has(t.section.id)) {
      sectionMap.set(t.section.id, { id: t.section.id, name: t.section.name, tables: [] });
    }
    sectionMap.get(t.section.id)!.tables.push({ id: t.id, name: t.name });
  }
  return Array.from(sectionMap.values());
}

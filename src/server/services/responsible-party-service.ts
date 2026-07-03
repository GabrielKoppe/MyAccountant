import type { Prisma } from "@prisma/client";

import type { ActionContext } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  ArchiveResponsiblePartyInput,
  CreateResponsiblePartyInput,
  DeleteResponsiblePartyInput,
  UpdateResponsiblePartyInput,
} from "@/lib/schemas/responsible-party";

const log = logger.child({ module: "responsible-party-service" });

// Garante que todos os userIds são membros atuais da Account (tenant + integridade).
async function assertMembers(accountId: string, userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  const count = await prisma.accountMember.count({
    where: { accountId, userId: { in: uniqueIds } },
  });
  if (count !== uniqueIds.length) {
    throw new AppError("VALIDATION", "Todos os membros do grupo devem pertencer à Account");
  }
}

/**
 * Garante a personal party de um membro da Account (Spec 60 §2). Idempotente:
 * se já existe, reativa caso esteja arquivada (membro voltou); senão cria com 1 vínculo.
 * Deve rodar dentro da mesma transação em que o membro entra na conta.
 */
export async function ensurePersonalParty(
  client: Prisma.TransactionClient,
  accountId: string,
  userId: string,
  name: string,
) {
  const existing = await client.responsibleParty.findFirst({
    where: { accountId, kind: "personal", members: { some: { userId } } },
    select: { id: true, archivedAt: true },
  });
  if (existing) {
    if (existing.archivedAt) {
      await client.responsibleParty.update({
        where: { id: existing.id },
        data: { archivedAt: null },
      });
    }
    return existing.id;
  }
  const party = await client.responsibleParty.create({
    data: { accountId, name, kind: "personal", members: { create: { userId } } },
    select: { id: true },
  });
  log.info({ accountId, userId, partyId: party.id }, "Personal party auto-created");
  return party.id;
}

/**
 * Arquiva a personal party de um membro que saiu/foi removido da Account.
 * Preserva o histórico das transações; só some dos seletores de novas transações.
 */
export async function archivePersonalPartyForUser(
  client: Prisma.TransactionClient,
  accountId: string,
  userId: string,
) {
  await client.responsibleParty.updateMany({
    where: { accountId, kind: "personal", members: { some: { userId } }, archivedAt: null },
    data: { archivedAt: new Date() },
  });
}

export async function listResponsibleParties(accountId: string) {
  return prisma.responsibleParty.findMany({
    where: { accountId },
    include: { members: { select: { userId: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}

export async function createResponsibleParty(
  input: CreateResponsiblePartyInput,
  ctx: ActionContext,
) {
  if (input.kind === "group") {
    await assertMembers(ctx.accountId, input.memberUserIds);
  }

  const party = await prisma.responsibleParty.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      kind: input.kind,
      icon: input.icon ?? null,
      color: input.color ?? null,
      ...(input.kind === "group"
        ? { members: { create: input.memberUserIds.map((userId) => ({ userId })) } }
        : {}),
    },
    select: { id: true },
  });

  log.info({ accountId: ctx.accountId, partyId: party.id, kind: input.kind }, "Party created");
  return party;
}

export async function updateResponsibleParty(
  input: UpdateResponsiblePartyInput,
  ctx: ActionContext,
) {
  const existing = await prisma.responsibleParty.findFirst({
    where: { id: input.partyId, accountId: ctx.accountId },
    select: { id: true, kind: true },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Responsável não encontrado");

  if (input.memberUserIds) {
    if (existing.kind !== "group") {
      throw new AppError("VALIDATION", "Somente grupos têm membros");
    }
    await assertMembers(ctx.accountId, input.memberUserIds);
  }

  await prisma.$transaction(async (tx) => {
    await tx.responsibleParty.update({
      where: { id: input.partyId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    if (input.memberUserIds) {
      await tx.responsiblePartyMember.deleteMany({ where: { partyId: input.partyId } });
      await tx.responsiblePartyMember.createMany({
        data: input.memberUserIds.map((userId) => ({ partyId: input.partyId, userId })),
      });
    }
  });

  log.info({ accountId: ctx.accountId, partyId: input.partyId }, "Party updated");
}

export async function archiveResponsibleParty(
  input: ArchiveResponsiblePartyInput,
  ctx: ActionContext,
) {
  const { count } = await prisma.responsibleParty.updateMany({
    where: { id: input.partyId, accountId: ctx.accountId },
    data: { archivedAt: input.archived ? new Date() : null },
  });
  if (count === 0) throw new AppError("NOT_FOUND", "Responsável não encontrado");
}

export async function deleteResponsibleParty(
  input: DeleteResponsiblePartyInput,
  ctx: ActionContext,
) {
  const party = await prisma.responsibleParty.findFirst({
    where: { id: input.partyId, accountId: ctx.accountId },
    select: { kind: true },
  });
  if (!party) throw new AppError("NOT_FOUND", "Responsável não encontrado");
  if (party.kind === "personal") {
    throw new AppError("VALIDATION", "Responsáveis pessoais não podem ser excluídos");
  }
  // onDelete: SetNull nas transações preserva o histórico.
  await prisma.responsibleParty.delete({ where: { id: input.partyId } });
  log.info({ accountId: ctx.accountId, partyId: input.partyId }, "Party deleted");
}

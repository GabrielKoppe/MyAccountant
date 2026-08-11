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
  await assertMembers(ctx.accountId, input.memberUserIds);

  // "Tudo é responsável": a criação pela UI nasce sempre `group` — 0 membros é um
  // rótulo para alguém externo, 1 é uma persona, N é um grupo de verdade. `personal`
  // não passa por aqui (é auto-gerido por `ensurePersonalParty`).
  const party = await prisma.responsibleParty.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      kind: "group",
      icon: input.icon ?? null,
      color: input.color ?? null,
      members: { create: input.memberUserIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });

  log.info({ accountId: ctx.accountId, partyId: party.id }, "Party created");
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
    // "Tudo é responsável" — o vínculo é 0..N para qualquer responsável comum
    // (`group`), então o botão "+" da célula de membros nunca precisa checar `kind`.
    //
    // `personal` continua protegido: ele é criado automaticamente para cada membro da
    // conta e o vínculo dele é o próprio usuário — mexer nisso pela mão do usuário
    // deixaria um membro sem responsável pessoal, ou dois apontando para o mesmo.
    if (existing.kind === "personal") {
      throw new AppError("VALIDATION", "O responsável pessoal não aceita vínculo manual");
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

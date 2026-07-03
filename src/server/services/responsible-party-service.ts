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

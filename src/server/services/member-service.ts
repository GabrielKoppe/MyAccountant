import crypto from "crypto";

import { env } from "@/lib/env";
import { m } from "@/lib/messages";
import type {
  InviteMemberInput,
  RemoveMemberInput,
  RevokeInviteInput,
  UpdateMemberRoleInput,
} from "@/lib/schemas/account";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/server/api/errors";
import { inviteEmailTemplate } from "@/emails";
import { emailService } from "@/server/email/email-service";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { ActionContext } from "@/server/api/define-action";
import * as notificationService from "@/server/services/notification-service";
import {
  archivePersonalPartyForUser,
  ensurePersonalParty,
} from "@/server/services/responsible-party-service";

const log = logger.child({ module: "member-service" });

export async function inviteMember(input: InviteMemberInput, ctx: ActionContext) {
  const { email, role } = input;
  const { accountId, userId } = ctx;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });
  if (!account) throw new NotFoundError("Account", accountId);

  const existingMember = await prisma.accountMember.findFirst({
    where: {
      accountId,
      user: { email: { equals: email, mode: "insensitive" } },
    },
  });
  if (existingMember) throw new ConflictError(m.account.invite.alreadyMemberError);

  const existingInvite = await prisma.accountInvite.findFirst({
    where: {
      accountId,
      email: { equals: email, mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) throw new ConflictError(m.account.invite.pendingError);

  const inviter = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.accountInvite.create({
    data: {
      accountId,
      email,
      role,
      token,
      expiresAt,
      invitedById: userId,
    },
  });

  const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${token}`;
  void emailService.send({
    to: email,
    template: inviteEmailTemplate,
    props: {
      inviterName: inviter?.name ?? inviter?.email ?? "Um membro",
      accountName: account.name,
      role: m.account.roles[role],
      acceptUrl,
      expiresInDays: 7,
    },
  });

  log.info({ inviteId: invite.id, accountId, email }, "Member invited");
  return { inviteId: invite.id };
}

export async function revokeInvite(input: RevokeInviteInput, ctx: ActionContext) {
  const invite = await prisma.accountInvite.findUnique({
    where: { id: input.inviteId },
  });

  if (!invite || invite.accountId !== ctx.accountId) throw new NotFoundError("Convite");
  if (invite.status !== "pending") throw new ConflictError("Este convite não está mais pendente");

  await prisma.accountInvite.update({
    where: { id: invite.id },
    data: { status: "revoked" },
  });

  log.info({ inviteId: invite.id, accountId: ctx.accountId }, "Invite revoked");
}

/**
 * Carrega os dados de um convite a partir do token, para exibição na tela pública
 * de aceite (`/invite/accept`). Retorna `null` se o token não existir.
 * Expõe apenas campos seguros — quem tem o token é o próprio convidado.
 */
export async function getInviteByToken(token: string) {
  if (!token) return null;

  const invite = await prisma.accountInvite.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      accountId: true,
      account: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
  if (!invite) return null;

  const isExpired = invite.expiresAt < new Date();
  return {
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt,
    accountId: invite.accountId,
    accountName: invite.account.name,
    inviterName: invite.invitedBy.name ?? invite.invitedBy.email,
    isExpired,
    isValid: invite.status === "pending" && !isExpired,
  };
}

/**
 * Retorna o convite pendente e não expirado mais recente para um email, ou `null`.
 * Usado como rede de segurança no roteamento: um usuário recém-criado sem membership
 * é levado para o aceite do convite em vez do onboarding de criar account.
 */
export async function getPendingInviteForEmail(email: string) {
  return prisma.accountInvite.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
}

export async function acceptInvite(token: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) throw new UnauthorizedError();

  const invite = await prisma.accountInvite.findUnique({
    where: { token },
    include: { account: { select: { id: true, name: true } } },
  });

  if (!invite) throw new NotFoundError("Convite");
  if (invite.status !== "pending")
    throw new ForbiddenError("Este convite já foi usado ou revogado.");
  if (invite.expiresAt < new Date()) throw new ForbiddenError("Este convite expirou.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new ForbiddenError(m.account.acceptInvite.wrongEmail);
  }

  const alreadyMember = await prisma.accountMember.findUnique({
    where: {
      accountId_userId: { accountId: invite.accountId, userId },
    },
  });
  if (alreadyMember) throw new ConflictError(m.account.acceptInvite.alreadyMember);

  await prisma.$transaction(async (tx) => {
    await tx.accountMember.create({
      data: {
        accountId: invite.accountId,
        userId,
        role: invite.role,
        addedById: invite.invitedById,
      },
    });
    await tx.accountInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    // Personal party do novo membro (Spec 60 §2) — auto-criada/reativada no aceite.
    await ensurePersonalParty(tx, invite.accountId, userId, user.name ?? user.email);
  });

  void notificationService.notifyInviteAccepted({
    accountId: invite.accountId,
    actorId: userId,
    role: invite.role,
  });

  log.info({ inviteId: invite.id, accountId: invite.accountId, userId }, "Invite accepted");
  return { accountId: invite.accountId };
}

export async function declineInvite(token: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) throw new UnauthorizedError();

  const invite = await prisma.accountInvite.findUnique({ where: { token } });

  if (!invite) throw new NotFoundError("Convite");
  if (invite.status !== "pending")
    throw new ForbiddenError("Este convite já foi usado ou revogado.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new ForbiddenError(m.account.acceptInvite.wrongEmail);
  }

  await prisma.accountInvite.update({
    where: { id: invite.id },
    data: { status: "revoked" },
  });

  log.info({ inviteId: invite.id }, "Invite declined");
}

export async function removeMember(input: RemoveMemberInput, ctx: ActionContext) {
  if (input.targetUserId === ctx.userId) {
    throw new ForbiddenError(m.account.members.removeSelf);
  }

  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId: ctx.accountId, userId: input.targetUserId } },
  });
  if (!member) throw new NotFoundError("Membro");

  if (member.role === "owner") {
    const ownerCount = await prisma.accountMember.count({
      where: { accountId: ctx.accountId, role: "owner" },
    });
    if (ownerCount <= 1) throw new ForbiddenError(m.account.members.lastOwnerError);
  }

  await prisma.$transaction(async (tx) => {
    await tx.accountMember.delete({
      where: { accountId_userId: { accountId: ctx.accountId, userId: input.targetUserId } },
    });
    // Arquiva a personal party (histórico preservado, some dos seletores).
    await archivePersonalPartyForUser(tx, ctx.accountId, input.targetUserId);
  });

  log.info({ targetUserId: input.targetUserId, accountId: ctx.accountId }, "Member removed");
}

export async function updateMemberRole(input: UpdateMemberRoleInput, ctx: ActionContext) {
  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId: ctx.accountId, userId: input.targetUserId } },
  });
  if (!member) throw new NotFoundError("Membro");

  if (member.role === "owner" && input.role !== "owner") {
    const ownerCount = await prisma.accountMember.count({
      where: { accountId: ctx.accountId, role: "owner" },
    });
    if (ownerCount <= 1) throw new ForbiddenError(m.account.members.lastOwnerError);
  }

  await prisma.accountMember.update({
    where: { accountId_userId: { accountId: ctx.accountId, userId: input.targetUserId } },
    data: { role: input.role },
  });

  log.info(
    { targetUserId: input.targetUserId, role: input.role, accountId: ctx.accountId },
    "Member role updated",
  );
}

export async function leaveAccount(ctx: ActionContext) {
  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId: ctx.accountId, userId: ctx.userId } },
  });
  if (!member) throw new NotFoundError("Membro");

  if (member.role === "owner") {
    const ownerCount = await prisma.accountMember.count({
      where: { accountId: ctx.accountId, role: "owner" },
    });
    if (ownerCount <= 1) {
      const totalMembers = await prisma.accountMember.count({
        where: { accountId: ctx.accountId },
      });
      if (totalMembers > 1) {
        throw new ForbiddenError(
          "Você é o único proprietário. Promova outro membro antes de sair.",
        );
      }
      throw new ForbiddenError("Você é o único membro. Delete a conta em vez de sair.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.accountMember.delete({
      where: { accountId_userId: { accountId: ctx.accountId, userId: ctx.userId } },
    });
    await archivePersonalPartyForUser(tx, ctx.accountId, ctx.userId);
  });

  log.info({ accountId: ctx.accountId, userId: ctx.userId }, "Member left account");
}

export async function deleteAccount(ctx: ActionContext) {
  const account = await prisma.account.findUnique({
    where: { id: ctx.accountId },
    select: { name: true },
  });
  if (!account) throw new NotFoundError("Account");

  await prisma.account.delete({ where: { id: ctx.accountId } });

  log.info({ accountId: ctx.accountId, userId: ctx.userId }, "Account deleted");
}

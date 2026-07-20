import type { Prisma } from "@prisma/client";

import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "audit-service" });

export type AuditAction =
  | "member.role_changed"
  | "member.removed"
  | "member.left"
  | "invite.sent"
  | "invite.accepted"
  | "invite.revoked"
  | "auth.password_reset";

export type RecordAuditInput = {
  accountId: string;
  actorUserId: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Grava uma entrada de auditoria (SEC-08a). Best-effort: uma falha aqui NÃO
 * deve derrubar a operação de negócio — apenas logamos o erro.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        accountId: input.accountId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    log.error({ err, action: input.action, accountId: input.accountId }, "Failed to record audit log");
  }
}

export async function listAuditLogs(accountId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
}

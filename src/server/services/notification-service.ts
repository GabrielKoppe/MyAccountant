import type { AccountMemberRole } from "@prisma/client";

import { m } from "@/lib/messages";
import { formatMonthLabel } from "@/lib/dates";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "notification-service" });

const NOTIFICATION_LIMIT = 100;

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  link: string | null;
  count: number;
  isRead: boolean;
  createdAt: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getActorName(actorId: string): Promise<string> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true, email: true },
  });
  return actor?.name ?? actor?.email ?? "Um membro";
}

async function getMonthLabel(monthId: string): Promise<string> {
  const month = await prisma.month.findUnique({
    where: { id: monthId },
    select: { year: true, month: true },
  });
  if (!month) return "";
  return formatMonthLabel(month.year, month.month);
}

async function getOtherMemberIds(accountId: string, excludeUserId: string): Promise<string[]> {
  const members = await prisma.accountMember.findMany({
    where: { accountId, userId: { not: excludeUserId } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function enforceNotificationLimit(userId: string, accountId: string): Promise<void> {
  const total = await prisma.notification.count({ where: { userId, accountId } });
  if (total <= NOTIFICATION_LIMIT) return;

  const excess = await prisma.notification.findMany({
    where: { userId, accountId },
    orderBy: { createdAt: "asc" },
    take: total - NOTIFICATION_LIMIT,
    select: { id: true },
  });
  await prisma.notification.deleteMany({
    where: { id: { in: excess.map((n) => n.id) } },
  });
}

async function upsertNotification(params: {
  userId: string;
  accountId: string;
  actorId: string;
  type: string;
  title: string;
  link: string | null;
}): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      accountId: params.accountId,
      type: params.type,
      link: params.link,
      actorId: params.actorId,
      isRead: false,
    },
    select: { id: true, count: true },
  });

  if (existing) {
    const newCount = existing.count + 1;
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        count: newCount,
        title: params.title.replace(/\d+/, String(newCount)),
        createdAt: new Date(),
      },
    });
  } else {
    await prisma.notification.create({ data: { ...params, count: 1 } });
    await enforceNotificationLimit(params.userId, params.accountId);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function notifyTransactionMutation(params: {
  accountId: string;
  actorId: string;
  type: "transactions_added" | "transaction_deleted";
  monthId: string;
}): Promise<void> {
  try {
    const [actorName, monthLabel, recipientIds] = await Promise.all([
      getActorName(params.actorId),
      getMonthLabel(params.monthId),
      getOtherMemberIds(params.accountId, params.actorId),
    ]);

    if (recipientIds.length === 0) return;

    const title =
      params.type === "transactions_added"
        ? m.notifications.types.transactions_added(actorName, 1, monthLabel)
        : m.notifications.types.transaction_deleted(actorName, 1, monthLabel);

    await Promise.all(
      recipientIds.map((userId) =>
        upsertNotification({
          userId,
          accountId: params.accountId,
          actorId: params.actorId,
          type: params.type,
          title,
          link: params.monthId,
        }),
      ),
    );

    log.debug(
      {
        accountId: params.accountId,
        actorId: params.actorId,
        type: params.type,
        recipients: recipientIds.length,
      },
      "Notifications dispatched",
    );
  } catch (err) {
    log.error({ err, ...params }, "Failed to dispatch transaction notifications");
  }
}

export async function notifyInviteAccepted(params: {
  accountId: string;
  actorId: string;
  role: AccountMemberRole;
}): Promise<void> {
  try {
    const [actorName, recipientIds] = await Promise.all([
      getActorName(params.actorId),
      getOtherMemberIds(params.accountId, params.actorId),
    ]);

    if (recipientIds.length === 0) return;

    const roleLabel = m.account.roles[params.role];
    const title = m.notifications.types.invite_accepted(actorName, roleLabel);

    await Promise.all(
      recipientIds.map((userId) =>
        prisma.notification
          .create({
            data: {
              userId,
              accountId: params.accountId,
              actorId: params.actorId,
              type: "invite_accepted",
              title,
              link: null,
              count: 1,
            },
          })
          .then(() => enforceNotificationLimit(userId, params.accountId)),
      ),
    );

    log.debug(
      { accountId: params.accountId, actorId: params.actorId, recipients: recipientIds.length },
      "Invite accepted notifications dispatched",
    );
  } catch (err) {
    log.error({ err, ...params }, "Failed to dispatch invite_accepted notifications");
  }
}

export async function listAndMarkAllRead(
  userId: string,
  accountId: string,
): Promise<NotificationItem[]> {
  const notifications = await prisma.notification.findMany({
    where: { userId, accountId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      title: true,
      link: true,
      count: true,
      isRead: true,
      createdAt: true,
    },
  });

  void prisma.notification.updateMany({
    where: { userId, accountId, isRead: false },
    data: { isRead: true },
  });

  return notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getUnreadCount(userId: string, accountId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, accountId, isRead: false } });
}

import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import {
  getUnreadCount,
  listAndMarkAllRead,
  notifyInviteAccepted,
  notifyTransactionMutation,
} from "./notification-service";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ACTOR = { id: "user-actor-1", name: "Maria", email: "maria@test.com" };
const RECIPIENT_ID = "user-recipient-1";
const MONTH = { id: "month-test-1", year: 2026, month: 1 };

function mockPrerequisites() {
  prismaMock.user.findUnique.mockResolvedValue(ACTOR as any);
  prismaMock.month.findUnique.mockResolvedValue(MONTH as any);
  prismaMock.accountMember.findMany.mockResolvedValue([
    { userId: RECIPIENT_ID } as any,
  ]);
  prismaMock.notification.findFirst.mockResolvedValue(null);
  prismaMock.notification.create.mockResolvedValue({ id: "notif-1" } as any);
  prismaMock.notification.count.mockResolvedValue(1);
}

// ─── notifyTransactionMutation ───────────────────────────────────────────────

describe("notifyTransactionMutation", () => {
  it("cria notificação para cada membro exceto o ator", async () => {
    mockPrerequisites();

    await notifyTransactionMutation({
      accountId: TEST_CTX.accountId,
      actorId: ACTOR.id,
      type: "transactions_added",
      monthId: MONTH.id,
    });

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: RECIPIENT_ID,
          accountId: TEST_CTX.accountId,
          actorId: ACTOR.id,
          type: "transactions_added",
          link: MONTH.id,
        }),
      }),
    );
  });

  it("não gera notificação se não houver outros membros", async () => {
    prismaMock.user.findUnique.mockResolvedValue(ACTOR as any);
    prismaMock.month.findUnique.mockResolvedValue(MONTH as any);
    prismaMock.accountMember.findMany.mockResolvedValue([]);

    await notifyTransactionMutation({
      accountId: TEST_CTX.accountId,
      actorId: ACTOR.id,
      type: "transactions_added",
      monthId: MONTH.id,
    });

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(prismaMock.notification.findFirst).not.toHaveBeenCalled();
  });

  it("faz upsert em notificação não lida existente do mesmo ator+mês", async () => {
    mockPrerequisites();
    prismaMock.notification.findFirst.mockResolvedValue({
      id: "existing-notif-1",
      count: 2,
    } as any);
    prismaMock.notification.update.mockResolvedValue({} as any);

    await notifyTransactionMutation({
      accountId: TEST_CTX.accountId,
      actorId: ACTOR.id,
      type: "transactions_added",
      monthId: MONTH.id,
    });

    expect(prismaMock.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-notif-1" },
        data: expect.objectContaining({ count: 3 }),
      }),
    );
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("cria nova notificação se a anterior já foi lida", async () => {
    mockPrerequisites();
    // findFirst retorna null (a query filtra isRead: false)
    prismaMock.notification.findFirst.mockResolvedValue(null);

    await notifyTransactionMutation({
      accountId: TEST_CTX.accountId,
      actorId: ACTOR.id,
      type: "transactions_added",
      monthId: MONTH.id,
    });

    expect(prismaMock.notification.create).toHaveBeenCalled();
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it("não lança exceção em caso de erro — falha silenciosa (fire-and-forget)", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB error"));

    await expect(
      notifyTransactionMutation({
        accountId: TEST_CTX.accountId,
        actorId: ACTOR.id,
        type: "transactions_added",
        monthId: MONTH.id,
      }),
    ).resolves.not.toThrow();
  });
});

// ─── notifyInviteAccepted ────────────────────────────────────────────────────

describe("notifyInviteAccepted", () => {
  it("cria notificação para todos os membros existentes", async () => {
    prismaMock.user.findUnique.mockResolvedValue(ACTOR as any);
    prismaMock.accountMember.findMany.mockResolvedValue([
      { userId: RECIPIENT_ID } as any,
    ]);
    prismaMock.notification.create.mockResolvedValue({ id: "notif-2" } as any);
    prismaMock.notification.count.mockResolvedValue(1);

    await notifyInviteAccepted({
      accountId: TEST_CTX.accountId,
      actorId: ACTOR.id,
      role: "editor",
    });

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: RECIPIENT_ID,
          type: "invite_accepted",
          link: null,
        }),
      }),
    );
  });
});

// ─── listAndMarkAllRead ──────────────────────────────────────────────────────

describe("listAndMarkAllRead", () => {
  it("retorna lista e dispara markAllRead em background", async () => {
    const fakeNotifs = [
      {
        id: "n1",
        type: "transactions_added",
        title: "Maria adicionou 1 transação em Jan/2026",
        link: "month-1",
        count: 1,
        isRead: false,
        createdAt: new Date("2026-06-01T10:00:00Z"),
      },
    ];
    prismaMock.notification.findMany.mockResolvedValue(fakeNotifs as any);
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 } as any);

    const result = await listAndMarkAllRead("user-1", "acc-1");

    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe("2026-06-01T10:00:00.000Z");
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", accountId: "acc-1" } }),
    );
  });
});

// ─── getUnreadCount ──────────────────────────────────────────────────────────

describe("getUnreadCount", () => {
  it("retorna contagem de notificações não lidas", async () => {
    prismaMock.notification.count.mockResolvedValue(5);

    const count = await getUnreadCount("user-1", "acc-1");

    expect(count).toBe(5);
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: "user-1", accountId: "acc-1", isRead: false },
    });
  });
});

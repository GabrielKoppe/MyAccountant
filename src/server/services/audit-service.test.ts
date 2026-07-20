import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { listAuditLogs, recordAudit } from "./audit-service";

describe("recordAudit", () => {
  it("cria um AuditLog com os campos fornecidos", async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: "log-1" } as never);

    await recordAudit({
      accountId: "acc-1",
      actorUserId: "user-1",
      action: "member.role_changed",
      targetType: "member",
      targetId: "user-2",
      metadata: { from: "editor", to: "owner" },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        accountId: "acc-1",
        actorUserId: "user-1",
        action: "member.role_changed",
        targetType: "member",
        targetId: "user-2",
        metadata: { from: "editor", to: "owner" },
      },
    });
  });

  it("não lança se a gravação falhar (auditoria é best-effort)", async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error("db down"));
    await expect(
      recordAudit({ accountId: "a", actorUserId: "u", action: "invite.sent", targetType: "invite" }),
    ).resolves.toBeUndefined();
  });
});

describe("listAuditLogs", () => {
  it("busca logs filtrados por accountId, mais recentes primeiro", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ id: "l1" }] as never);
    const result = await listAuditLogs("acc-1", 50);
    expect(result).toEqual([{ id: "l1" }]);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });
});

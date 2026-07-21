import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import {
  createBalanceAccount,
  updateBalanceAccount,
  archiveBalanceAccount,
  deleteBalanceAccount,
  upsertBalanceSnapshot,
  upsertBalanceSnapshots,
} from "./balance-account-service";

// ─── createBalanceAccount ─────────────────────────────────────────────────

describe("createBalanceAccount", () => {
  it("deve criar conta patrimonial com sucesso", async () => {
    prismaMock.balanceAccount.create.mockResolvedValue({ id: "ba-1" } as any);

    const result = await createBalanceAccount(
      { kind: "asset", name: "Conta Nubank", institutionId: null },
      TEST_CTX,
    );

    expect(result.balanceAccountId).toBe("ba-1");
    expect(prismaMock.balanceAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          kind: "asset",
          name: "Conta Nubank",
          institutionId: null,
          createdById: "user-test-1",
        }),
      }),
    );
  });
});

// ─── updateBalanceAccount ─────────────────────────────────────────────────

describe("updateBalanceAccount", () => {
  it("deve atualizar conta com sucesso", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.balanceAccount.update.mockResolvedValue({} as any);

    await updateBalanceAccount(
      { balanceAccountId: "ba-1", name: "Novo nome", institutionId: null },
      TEST_CTX,
    );

    expect(prismaMock.balanceAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ba-1" },
        data: { name: "Novo nome", institutionId: null },
      }),
    );
  });

  it("não deve atualizar conta de outra account (multi-tenancy)", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      updateBalanceAccount({ balanceAccountId: "ba-1", name: "X", institutionId: null }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.balanceAccount.update).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando conta não existe", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue(null);

    await expect(
      updateBalanceAccount(
        { balanceAccountId: "ba-inexistente", name: "X", institutionId: null },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.balanceAccount.update).not.toHaveBeenCalled();
  });
});

// ─── archiveBalanceAccount ────────────────────────────────────────────────

describe("archiveBalanceAccount", () => {
  it("deve arquivar conta preenchendo archivedAt", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.balanceAccount.update.mockResolvedValue({} as any);

    await archiveBalanceAccount({ balanceAccountId: "ba-1", archived: true }, TEST_CTX);

    expect(prismaMock.balanceAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ba-1" },
        data: { archivedAt: expect.any(Date) },
      }),
    );
  });

  it("deve desarquivar conta zerando archivedAt", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.balanceAccount.update.mockResolvedValue({} as any);

    await archiveBalanceAccount({ balanceAccountId: "ba-1", archived: false }, TEST_CTX);

    expect(prismaMock.balanceAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ba-1" },
        data: { archivedAt: null },
      }),
    );
  });

  it("não deve arquivar conta de outra account (multi-tenancy)", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      archiveBalanceAccount({ balanceAccountId: "ba-1", archived: true }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.balanceAccount.update).not.toHaveBeenCalled();
  });
});

// ─── deleteBalanceAccount ─────────────────────────────────────────────────

describe("deleteBalanceAccount", () => {
  it("deve excluir conta com sucesso", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.balanceAccount.delete.mockResolvedValue({} as any);

    await deleteBalanceAccount({ balanceAccountId: "ba-1" }, TEST_CTX);

    expect(prismaMock.balanceAccount.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ba-1" } }),
    );
  });

  it("não deve excluir conta de outra account (multi-tenancy)", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteBalanceAccount({ balanceAccountId: "ba-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.balanceAccount.delete).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando conta não existe", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue(null);

    await expect(
      deleteBalanceAccount({ balanceAccountId: "ba-inexistente" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.balanceAccount.delete).not.toHaveBeenCalled();
  });
});

// ─── upsertBalanceSnapshot ────────────────────────────────────────────────

describe("upsertBalanceSnapshot", () => {
  it("deve fazer upsert idempotente pelo par (balanceAccountId, capturedOn)", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.balanceSnapshot.upsert.mockResolvedValue({} as any);

    const capturedOn = new Date("2026-07-01");
    await upsertBalanceSnapshot(
      { balanceAccountId: "ba-1", balanceCents: 12345n, capturedOn },
      TEST_CTX,
    );

    expect(prismaMock.balanceSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { balanceAccountId_capturedOn: { balanceAccountId: "ba-1", capturedOn } },
        create: expect.objectContaining({
          accountId: "acc-test-1",
          balanceAccountId: "ba-1",
          balanceCents: 12345n,
          capturedOn,
          createdById: "user-test-1",
        }),
        update: { balanceCents: 12345n },
      }),
    );
  });

  it("não deve registrar saldo em conta de outra account (multi-tenancy)", async () => {
    prismaMock.balanceAccount.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      upsertBalanceSnapshot(
        { balanceAccountId: "ba-1", balanceCents: 12345n, capturedOn: new Date("2026-07-01") },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.balanceSnapshot.upsert).not.toHaveBeenCalled();
  });
});

// ─── upsertBalanceSnapshots (bulk) ────────────────────────────────────────

describe("upsertBalanceSnapshots", () => {
  it("deve fazer upsert de N contas numa mesma data via $transaction", async () => {
    prismaMock.balanceAccount.findMany.mockResolvedValue([{ id: "ba-1" }, { id: "ba-2" }] as any);
    prismaMock.$transaction.mockResolvedValue([] as any);

    const capturedOn = new Date("2026-07-01");
    await upsertBalanceSnapshots(
      {
        capturedOn,
        entries: [
          { balanceAccountId: "ba-1", balanceCents: 1000n },
          { balanceAccountId: "ba-2", balanceCents: -500n },
        ],
      },
      TEST_CTX,
    );

    expect(prismaMock.balanceAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["ba-1", "ba-2"] }, accountId: "acc-test-1" },
      }),
    );
    expect(prismaMock.balanceSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { balanceAccountId_capturedOn: { balanceAccountId: "ba-1", capturedOn } },
        create: expect.objectContaining({ accountId: "acc-test-1", balanceCents: 1000n }),
        update: { balanceCents: 1000n },
      }),
    );
    expect(prismaMock.balanceSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { balanceAccountId_capturedOn: { balanceAccountId: "ba-2", capturedOn } },
        create: expect.objectContaining({ accountId: "acc-test-1", balanceCents: -500n }),
        update: { balanceCents: -500n },
      }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("não deve gravar nenhum snapshot se uma conta não pertence à account (multi-tenancy)", async () => {
    // apenas ba-1 pertence à account; ba-2 é de outra account (não retornado pelo findMany filtrado)
    prismaMock.balanceAccount.findMany.mockResolvedValue([{ id: "ba-1" }] as any);

    await expect(
      upsertBalanceSnapshots(
        {
          capturedOn: new Date("2026-07-01"),
          entries: [
            { balanceAccountId: "ba-1", balanceCents: 1000n },
            { balanceAccountId: "ba-2", balanceCents: -500n },
          ],
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

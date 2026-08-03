import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

import { calcInstallmentAmounts } from "@/lib/installment-utils";

// Mock Prisma at module level
vi.mock("@/server/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
// Mock logger
vi.mock("@/server/logger", () => ({ logger: { child: () => ({ info: vi.fn(), warn: vi.fn() }) } }));

// ─── calcInstallmentAmounts ───────────────────────────────────────────────────

describe("calcInstallmentAmounts", () => {
  it("divides evenly without remainder", () => {
    const amounts = calcInstallmentAmounts(1200n, 12);
    expect(amounts.length).toBe(12);
    expect(amounts.every((a) => a === 100n)).toBe(true);
  });

  it("puts remainder on the last installment", () => {
    // 100 / 3 = 33 remainder 1 → [33, 33, 34]
    const amounts = calcInstallmentAmounts(100n, 3);
    expect(amounts).toEqual([33n, 33n, 34n]);
    expect(amounts.reduce((a, b) => a + b, 0n)).toBe(100n);
  });

  it("total always sums to totalCents", () => {
    for (const [total, count] of [
      [10001n, 7],
      [99999n, 11],
      [123456n, 12],
    ] as [bigint, number][]) {
      const amounts = calcInstallmentAmounts(total, count);
      expect(amounts.reduce((a, b) => a + b, 0n)).toBe(total);
    }
  });

  it("applies downPaymentCents to first installment", () => {
    // Total 1200, entry 200 → 1st = 200, remaining 1000 / 11 = 90.9 → [90 × 10, 100]
    const amounts = calcInstallmentAmounts(1200n, 12, 200n);
    expect(amounts[0]).toBe(200n);
    expect(amounts.reduce((a, b) => a + b, 0n)).toBe(1200n);
  });

  it("puts remainder of remaining on last installment when downPayment set", () => {
    // Total 100, entry 10 → remaining 90 / 2 = 45 → [10, 45, 45]
    const amounts = calcInstallmentAmounts(100n, 3, 10n);
    expect(amounts[0]).toBe(10n);
    expect(amounts.reduce((a, b) => a + b, 0n)).toBe(100n);
  });
});

// ─── createInstallmentGroup service ──────────────────────────────────────────
// (Integration tests require a real DB; unit tests use mocked Prisma)

import * as service from "@/server/services/installment-service";
import { prisma } from "@/server/prisma";
import type { ActionContext } from "@/server/api/define-action";

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

const mockCtx: ActionContext = {
  userId: "user-1",
  accountId: "acc-1",
  role: "owner",
};

describe("createInstallmentGroup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws NotFoundError when table not found", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue(null);

    await expect(
      service.createInstallmentGroup(
        {
          description: "Notebook",
          totalCents: 120000n,
          installmentCount: 12,
          startDate: new Date("2026-07-01"),
          tableId: "table-x",
        },
        mockCtx,
      ),
    ).rejects.toThrow("Tabela");
  });

  it("creates group + transaction + pending installments via $transaction", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      id: "table-1",
      accountId: "acc-1",
      monthId: "month-1",
      sectionId: "sec-current",
      tableTypeId: null,
    } as never);
    // Nenhum mês existente para as datas das parcelas
    prismaMock.month.findMany.mockResolvedValue([]);

    const txMock = {
      installmentGroup: { create: vi.fn().mockResolvedValue({ id: "group-1" }) },
      transaction: { create: vi.fn().mockResolvedValue({ id: "tx-1" }) },
      pendingInstallment: { createMany: vi.fn().mockResolvedValue({ count: 11 }) },
    };
    prismaMock.$transaction.mockImplementation(
      async (fn: Parameters<typeof prismaMock.$transaction>[0]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (fn as (tx: any) => Promise<unknown>)(txMock);
      },
    );

    const result = await service.createInstallmentGroup(
      {
        description: "Notebook",
        totalCents: 120000n,
        installmentCount: 12,
        startDate: new Date("2026-07-01"),
        tableId: "table-1",
      },
      mockCtx,
    );

    expect(result.installmentGroupId).toBe("group-1");
    expect(result.firstTransactionId).toBe("tx-1");
    expect(result.convertedImmediately).toBe(0);
    expect(txMock.pendingInstallment.createMany).toHaveBeenCalledOnce();
    const pending = txMock.pendingInstallment.createMany.mock.calls[0][0].data as unknown[];
    expect(pending).toHaveLength(11);
  });
});

// ─── convertPendingInstallmentsForMonth ──────────────────────────────────────

describe("convertPendingInstallmentsForMonth — empty", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns converted=0 when no pending installments", async () => {
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);

    const result = await service.convertPendingInstallmentsForMonth(
      "acc-1",
      "month-1",
      2026,
      7,
      "user-1",
    );

    expect(result.converted).toBe(0);
    expect(result.failed).toHaveLength(0);
  });
});

// ─── restoreAsPendingInstallment ─────────────────────────────────────────────

describe("restoreAsPendingInstallment", () => {
  beforeEach(() => vi.resetAllMocks());

  const baseData = {
    accountId: "acc-1",
    installmentGroupId: "group-1",
    installmentNumber: 3,
    amountCents: 10000n,
    occurredOn: new Date("2026-09-01"),
    description: "Notebook",
    categoryId: "cat-1",
    subcategoryId: null,
    notes: null,
  };

  it("creates PendingInstallment with preserved data", async () => {
    prismaMock.pendingInstallment.findFirst.mockResolvedValue(null);
    prismaMock.pendingInstallment.create.mockResolvedValue({} as never);

    await service.restoreAsPendingInstallment(baseData);

    expect(prismaMock.pendingInstallment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "acc-1",
        installmentGroupId: "group-1",
        installmentNumber: 3,
        amountCents: 10000n,
        expectedDate: baseData.occurredOn,
        description: "Notebook",
        categoryId: "cat-1",
      }),
    });
  });

  it("is idempotent — skips creation if PendingInstallment already exists", async () => {
    prismaMock.pendingInstallment.findFirst.mockResolvedValue({ id: "pi-1" } as never);

    await service.restoreAsPendingInstallment(baseData);

    expect(prismaMock.pendingInstallment.create).not.toHaveBeenCalled();
  });
});

// ─── undoInstallmentGroup ─────────────────────────────────────────────────────

describe("undoInstallmentGroup", () => {
  beforeEach(() => vi.resetAllMocks());

  it("multi-tenancy: throws NotFoundError when group belongs to another account and never touches update/delete", async () => {
    prismaMock.installmentGroup.findUnique.mockResolvedValue(null);

    await expect(
      service.undoInstallmentGroup({ installmentGroupId: "group-other-acc" }, mockCtx),
    ).rejects.toThrow("Grupo de parcelamento");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.transaction.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.pendingInstallment.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.installmentGroup.delete).not.toHaveBeenCalled();
  });

  it("happy path: dissociates transactions, deletes pending installments and deletes the group inside $transaction", async () => {
    prismaMock.installmentGroup.findUnique.mockResolvedValue({ id: "group-1" } as never);

    const txMock = {
      transaction: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
      pendingInstallment: { deleteMany: vi.fn().mockResolvedValue({ count: 9 }) },
      installmentGroup: { delete: vi.fn().mockResolvedValue({ id: "group-1" }) },
    };
    prismaMock.$transaction.mockImplementation(
      async (fn: Parameters<typeof prismaMock.$transaction>[0]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (fn as (tx: any) => Promise<unknown>)(txMock);
      },
    );

    const result = await service.undoInstallmentGroup(
      { installmentGroupId: "group-1" },
      mockCtx,
    );

    expect(prismaMock.installmentGroup.findUnique).toHaveBeenCalledWith({
      where: { id: "group-1", accountId: "acc-1" },
      select: { id: true },
    });
    expect(txMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { installmentGroupId: "group-1", accountId: "acc-1" },
      data: { installmentGroupId: null, installmentNumber: null },
    });
    expect(txMock.pendingInstallment.deleteMany).toHaveBeenCalledWith({
      where: { installmentGroupId: "group-1", accountId: "acc-1" },
    });
    expect(txMock.installmentGroup.delete).toHaveBeenCalledWith({ where: { id: "group-1" } });
    expect(result).toEqual({ dissociatedTransactions: 3, deletedPending: 9 });
  });
});

// ─── Spec 73 ─────────────────────────────────────────────────────────────────

describe("convertPendingInstallmentsForMonth — filtros da spec 73", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sem seleção explícita: só grupos com autoCreateOnNewMonth e pendências não pagas, range em UTC", async () => {
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);

    await service.convertPendingInstallmentsForMonth("acc-1", "month-1", 2026, 7, "user-1");

    const where = prismaMock.pendingInstallment.findMany.mock.calls[0][0]!.where as {
      accountId: string;
      settledAt: null;
      group?: { autoCreateOnNewMonth: boolean };
      expectedDate: { gte: Date; lte: Date };
    };
    expect(where.accountId).toBe("acc-1");
    expect(where.settledAt).toBeNull();
    expect(where.group).toEqual({ autoCreateOnNewMonth: true });
    // Bordas em UTC: 2026-07-01T00:00:00Z até 2026-07-31T23:59:59.999Z
    expect(where.expectedDate.gte.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(where.expectedDate.lte.toISOString()).toBe("2026-07-31T23:59:59.999Z");
  });

  it("com pendingInstallmentIds: escopa nos ids e ignora a flag do grupo", async () => {
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);

    await service.convertPendingInstallmentsForMonth("acc-1", "month-1", 2026, 7, "user-1", {
      pendingInstallmentIds: ["pi-1", "pi-2"],
    });

    const where = prismaMock.pendingInstallment.findMany.mock.calls[0][0]!.where as {
      id?: { in: string[] };
      group?: unknown;
    };
    expect(where.id).toEqual({ in: ["pi-1", "pi-2"] });
    expect(where.group).toBeUndefined();
  });

  it("lista vazia de ids não converte nada (não cai no caminho automático)", async () => {
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);

    const result = await service.convertPendingInstallmentsForMonth(
      "acc-1",
      "month-1",
      2026,
      7,
      "user-1",
      { pendingInstallmentIds: [] },
    );

    const where = prismaMock.pendingInstallment.findMany.mock.calls[0][0]!.where as {
      id?: { in: string[] };
    };
    expect(where.id).toEqual({ in: [] });
    expect(result.converted).toBe(0);
  });
});

describe("setPendingInstallmentSettled", () => {
  beforeEach(() => vi.resetAllMocks());

  it("multi-tenancy: parcela de outra account → NotFoundError", async () => {
    prismaMock.pendingInstallment.findFirst.mockResolvedValue(null);

    await expect(
      service.setPendingInstallmentSettled(
        { pendingInstallmentId: "pi-outra", settled: true },
        mockCtx,
      ),
    ).rejects.toThrow("Parcela pendente");
    expect(prismaMock.pendingInstallment.findFirst).toHaveBeenCalledWith({
      where: { id: "pi-outra", accountId: "acc-1" },
      select: { id: true, installmentGroupId: true },
    });
    expect(prismaMock.pendingInstallment.update).not.toHaveBeenCalled();
  });

  it("marcar: grava settledAt e NÃO cria Transaction", async () => {
    prismaMock.pendingInstallment.findFirst.mockResolvedValue({
      id: "pi-1",
      installmentGroupId: "grp-1",
    } as never);
    prismaMock.pendingInstallment.update.mockResolvedValue({} as never);

    const result = await service.setPendingInstallmentSettled(
      { pendingInstallmentId: "pi-1", settled: true },
      mockCtx,
    );

    expect(result).toEqual({ settled: true });
    const call = prismaMock.pendingInstallment.update.mock.calls[0][0] as {
      data: { settledAt: Date | null };
    };
    expect(call.data.settledAt).toBeInstanceOf(Date);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it("desmarcar: limpa settledAt", async () => {
    prismaMock.pendingInstallment.findFirst.mockResolvedValue({
      id: "pi-1",
      installmentGroupId: "grp-1",
    } as never);
    prismaMock.pendingInstallment.update.mockResolvedValue({} as never);

    await service.setPendingInstallmentSettled(
      { pendingInstallmentId: "pi-1", settled: false },
      mockCtx,
    );

    expect(prismaMock.pendingInstallment.update).toHaveBeenCalledWith({
      where: { id: "pi-1" },
      data: { settledAt: null },
    });
  });
});

describe("setInstallmentGroupAutoCreate", () => {
  beforeEach(() => vi.resetAllMocks());

  it("multi-tenancy: grupo de outra account → NotFoundError", async () => {
    prismaMock.installmentGroup.findFirst.mockResolvedValue(null);

    await expect(
      service.setInstallmentGroupAutoCreate(
        { installmentGroupId: "grp-outra", autoCreateOnNewMonth: false },
        mockCtx,
      ),
    ).rejects.toThrow("Grupo de parcelamento");
    expect(prismaMock.installmentGroup.update).not.toHaveBeenCalled();
  });

  it("persiste a flag", async () => {
    prismaMock.installmentGroup.findFirst.mockResolvedValue({ id: "grp-1" } as never);
    prismaMock.installmentGroup.update.mockResolvedValue({} as never);

    const result = await service.setInstallmentGroupAutoCreate(
      { installmentGroupId: "grp-1", autoCreateOnNewMonth: false },
      mockCtx,
    );

    expect(result).toEqual({ autoCreateOnNewMonth: false });
    expect(prismaMock.installmentGroup.update).toHaveBeenCalledWith({
      where: { id: "grp-1" },
      data: { autoCreateOnNewMonth: false },
    });
  });
});

describe("settleInstallmentGroup — exclui parcela paga fora do app", () => {
  beforeEach(() => vi.resetAllMocks());

  it("busca pendências com settledAt: null", async () => {
    prismaMock.installmentGroup.findUnique.mockResolvedValue({
      id: "grp-1",
      description: "Notebook",
    } as never);
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);

    await expect(
      service.settleInstallmentGroup(
        { installmentGroupId: "grp-1", mode: "individual", tableId: "table-1", count: 2 },
        mockCtx,
      ),
    ).rejects.toThrow("Não há parcelas pendentes");

    expect(prismaMock.pendingInstallment.findMany).toHaveBeenCalledWith({
      where: { installmentGroupId: "grp-1", accountId: "acc-1", settledAt: null },
      orderBy: { installmentNumber: "asc" },
    });
  });
});

describe("findInstallmentGroupMatchesForImport", () => {
  beforeEach(() => vi.resetAllMocks());

  const CANDIDATE = {
    suggestionId: "ci:37",
    normalizedDescription: "cyan shoes",
    installmentCount: 3,
    occurredOn: "2026-05-04",
    installmentNumbers: [3],
  };

  function group(over: Partial<Record<string, unknown>> = {}) {
    return {
      id: "grp-1",
      description: "cyan shoes",
      installmentCount: 3,
      startDate: new Date("2026-05-01T00:00:00Z"),
      transactions: [{ installmentNumber: 2, occurredOn: new Date("2026-05-04T00:00:00Z") }],
      pendingInstallments: [{ installmentNumber: 1 }, { installmentNumber: 3 }],
      ...over,
    };
  }

  it("lista vazia de candidatos não consulta o banco", async () => {
    const result = await service.findInstallmentGroupMatchesForImport([], "acc-1");
    expect(result).toEqual([]);
    expect(prismaMock.installmentGroup.findMany).not.toHaveBeenCalled();
  });

  it("multi-tenancy: filtra por accountId e só descarta pendências pagas", async () => {
    prismaMock.installmentGroup.findMany.mockResolvedValue([]);
    await service.findInstallmentGroupMatchesForImport([CANDIDATE], "acc-1");

    const args = prismaMock.installmentGroup.findMany.mock.calls[0][0]!;
    expect((args.where as { accountId: string }).accountId).toBe("acc-1");
    expect(
      (args.select as { pendingInstallments: { where: unknown } }).pendingInstallments.where,
    ).toEqual({ settledAt: null });
  });

  it("casa pela data da compra (sinal 1)", async () => {
    prismaMock.installmentGroup.findMany.mockResolvedValue([group()] as never);

    const [match] = await service.findInstallmentGroupMatchesForImport([CANDIDATE], "acc-1");

    expect(match).toMatchObject({
      suggestionId: "ci:37",
      groupId: "grp-1",
      matchedBy: "purchase_date",
      pendingNumbers: [1, 3],
      launchedNumbers: [2],
      startDate: "2026-05-01",
    });
  });

  it("data diferente: casa pelo número de parcela pendente (sinal 2)", async () => {
    // "Anuidade Diferenciada" é re-datada a cada mês → sinal 1 falha
    prismaMock.installmentGroup.findMany.mockResolvedValue([
      group({
        description: "anuidade diferenciada",
        installmentCount: 12,
        transactions: [{ installmentNumber: 4, occurredOn: new Date("2026-06-23T00:00:00Z") }],
        pendingInstallments: [{ installmentNumber: 5 }, { installmentNumber: 6 }],
      }),
    ] as never);

    const [match] = await service.findInstallmentGroupMatchesForImport(
      [
        {
          ...CANDIDATE,
          normalizedDescription: "anuidade diferenciada",
          installmentCount: 12,
          occurredOn: "2026-07-22",
          installmentNumbers: [5],
        },
      ],
      "acc-1",
    );

    expect(match).toMatchObject({ groupId: "grp-1", matchedBy: "installment_number" });
  });

  it("dois grupos com a mesma data: ambíguo, sem vínculo", async () => {
    prismaMock.installmentGroup.findMany.mockResolvedValue([
      group({ id: "grp-1" }),
      group({ id: "grp-2" }),
    ] as never);

    const [match] = await service.findInstallmentGroupMatchesForImport([CANDIDATE], "acc-1");

    expect(match).toEqual({ suggestionId: "ci:37", ambiguous: true, candidateCount: 2 });
  });

  it("descrição diferente: nenhum casamento", async () => {
    prismaMock.installmentGroup.findMany.mockResolvedValue([
      group({ description: "outra compra" }),
    ] as never);

    const result = await service.findInstallmentGroupMatchesForImport([CANDIDATE], "acc-1");
    expect(result).toEqual([]);
  });
});

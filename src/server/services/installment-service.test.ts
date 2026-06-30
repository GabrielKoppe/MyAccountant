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

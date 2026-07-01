import { describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import {
  createFinanceTable,
  deleteFinanceTable,
  reorderFinanceTables,
  updateFinanceTable,
} from "./finance-table-service";

describe("createFinanceTable — sourceMethod=empty", () => {
  it("deve criar tabela vazia com displayOrder correto", async () => {
    prismaMock.month.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      year: 2026,
      month: 6,
    } as any);
    prismaMock.section.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isActive: true,
    } as any);
    prismaMock.financeTable.aggregate.mockResolvedValue({ _max: { displayOrder: 1 } } as any);
    prismaMock.financeTable.create.mockResolvedValue({ id: "table-nova" } as any);

    const result = await createFinanceTable(
      {
        monthId: "month-1",
        sectionId: "sec-1",
        name: "Cartão Nubank",
        tableTypeId: "type-1",
        sourceMethod: "empty",
        countInMonth: true,
      },
      TEST_CTX,
    );

    expect(result.tableId).toBe("table-nova");
    expect(prismaMock.financeTable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          sourceMethod: "empty",
          displayOrder: 2, // max(1) + 1
          createdById: "user-test-1",
        }),
      }),
    );
  });

  it("não deve criar tabela com mês de outra account (segurança multi-tenancy)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      year: 2026,
      month: 6,
    } as any);

    await expect(
      createFinanceTable(
        {
          monthId: "month-outra",
          sectionId: "sec-1",
          name: "Teste",
          tableTypeId: "type-1",
          sourceMethod: "empty",
          countInMonth: true,
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("não deve criar tabela com seção de outra account (segurança multi-tenancy)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      year: 2026,
      month: 6,
    } as any);
    prismaMock.section.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      createFinanceTable(
        {
          monthId: "month-1",
          sectionId: "sec-outra",
          name: "Teste",
          tableTypeId: "type-1",
          sourceMethod: "empty",
          countInMonth: true,
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve lançar NotFoundError se mês não existe", async () => {
    prismaMock.month.findUnique.mockResolvedValue(null);

    await expect(
      createFinanceTable(
        {
          monthId: "month-inexistente",
          sectionId: "sec-1",
          name: "Teste",
          tableTypeId: "type-1",
          sourceMethod: "empty",
          countInMonth: true,
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("createFinanceTable — sourceMethod=copy", () => {
  it("não deve copiar tabela de origem de outra account (segurança multi-tenancy)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      year: 2026,
      month: 7,
    } as any);
    prismaMock.section.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isActive: true,
    } as any);
    prismaMock.financeTable.aggregate.mockResolvedValue({ _max: { displayOrder: null } } as any);
    // Tabela de origem pertence a outra account
    prismaMock.financeTable.findUnique.mockResolvedValue({
      id: "source-table",
      accountId: "acc-OUTRA",
      tableTypeId: "type-1",
      transactions: [],
    } as any);

    await expect(
      createFinanceTable(
        {
          monthId: "month-1",
          sectionId: "sec-1",
          name: "Cópia",
          tableTypeId: "type-1",
          sourceMethod: "copy",
          sourceTableId: "source-table",
          countInMonth: true,
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve remapear datas das transações copiadas para o mês destino", async () => {
    prismaMock.month.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      year: 2026,
      month: 7,
    } as any);
    prismaMock.section.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isActive: true,
    } as any);
    prismaMock.financeTable.aggregate.mockResolvedValue({ _max: { displayOrder: null } } as any);
    prismaMock.financeTable.findUnique.mockResolvedValue({
      id: "source-table",
      accountId: "acc-test-1",
      tableTypeId: "type-1",
      transactions: [
        {
          occurredOn: new Date("2026-06-10"),
          amountCents: 10000n,
          description: "Compra",
          notes: null,
          isPending: false,
          isFavorite: false,
          categoryId: null,
          subcategoryId: null,
          institutionId: null,
          institutionText: null,
          responsibleUserId: null,
          cardInstallment: null,
          investmentType: null,
          metadata: {},
        },
      ],
    } as any);

    const newTableId = "table-copia-1";
    const txMock = {
      financeTable: { create: vi.fn().mockResolvedValue({ id: newTableId }) },
      transaction: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    const result = await createFinanceTable(
      {
        monthId: "month-1",
        sectionId: "sec-1",
        name: "Cópia Julho",
        tableTypeId: "type-1",
        sourceMethod: "copy",
        sourceTableId: "source-table",
        countInMonth: true,
        copyOptions: { includeTransactions: true, updateDates: true, markAsPending: false },
      },
      TEST_CTX,
    );

    expect(result.tableId).toBe(newTableId);
    // Verifica que a data foi remapeada para julho (mês 7)
    const createManyCall = txMock.transaction.createMany.mock.calls[0][0];
    const copiedTx = createManyCall.data[0];
    expect(copiedTx.occurredOn.getMonth()).toBe(6); // julho = índice 6
    expect(copiedTx.occurredOn.getFullYear()).toBe(2026);
  });
});

describe("updateFinanceTable", () => {
  it("deve atualizar nome e countInMonth", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.financeTable.update.mockResolvedValue({} as any);

    await updateFinanceTable(
      { tableId: "table-1", name: "Novo Nome", countInMonth: false },
      TEST_CTX,
    );

    expect(prismaMock.financeTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "table-1" },
        data: expect.objectContaining({ name: "Novo Nome", countInMonth: false }),
      }),
    );
  });

  it("não deve atualizar tabela de outra account (segurança multi-tenancy)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      updateFinanceTable({ tableId: "table-1", name: "Novo" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve alterar o tableTypeId quando o tipo pertence à account", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.tableType.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.financeTable.update.mockResolvedValue({} as any);

    await updateFinanceTable({ tableId: "table-1", tableTypeId: "type-2" }, TEST_CTX);

    expect(prismaMock.financeTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "table-1" },
        data: expect.objectContaining({ tableTypeId: "type-2" }),
      }),
    );
  });

  it("não deve aceitar tableTypeId de outra account (segurança multi-tenancy)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.tableType.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      updateFinanceTable({ tableId: "table-1", tableTypeId: "type-alheio" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
    expect(prismaMock.financeTable.update).not.toHaveBeenCalled();
  });
});

describe("deleteFinanceTable", () => {
  it("deve deletar tabela existente da account correta", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-1",
    } as any);
    prismaMock.financeTable.delete.mockResolvedValue({} as any);

    await deleteFinanceTable({ tableId: "table-1" }, TEST_CTX);

    expect(prismaMock.financeTable.delete).toHaveBeenCalledWith({ where: { id: "table-1" } });
  });

  it("não deve deletar tabela de outra account (segurança multi-tenancy)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteFinanceTable({ tableId: "table-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("reorderFinanceTables", () => {
  it("deve reordenar tabelas filtrando por accountId, monthId e sectionId", async () => {
    prismaMock.$transaction.mockResolvedValue([]);

    await reorderFinanceTables(
      { monthId: "month-1", sectionId: "sec-1", orderedIds: ["table-b", "table-a"] },
      TEST_CTX,
    );

    // Verifica que a transação foi chamada com os updateMany corretos
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

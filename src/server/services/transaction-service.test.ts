import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { buildTransaction } from "@/../tests/fixtures/transaction";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import {
  bulkDelete,
  bulkUpdate,
  createTransaction,
  deleteTransaction,
  duplicateTransaction,
  updateTransaction,
} from "./transaction-service";

describe("createTransaction", () => {
  it("deve criar transação com sectionId e monthId desnormalizados da tabela", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-novo-1" } as any);

    const result = await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 10000n,
        isPending: false,
        isFavorite: false,
      },
      TEST_CTX,
    );

    expect(result.transactionId).toBe("tx-novo-1");
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          sectionId: "sec-test-1",
          monthId: "month-test-1",
          createdById: "user-test-1",
        }),
      }),
    );
  });

  it("deve lançar NotFoundError se tabela pertence a outra account (segurança multi-tenancy)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      sectionId: "sec-1",
      monthId: "month-1",
    } as any);

    await expect(
      createTransaction(
        {
          tableId: "table-test-1",
          occurredOn: new Date("2026-01-15"),
          amountCents: 10000n,
          isPending: false,
          isFavorite: false,
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve lançar NotFoundError se tabela não existe", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue(null);

    await expect(
      createTransaction(
        {
          tableId: "table-inexistente",
          occurredOn: new Date("2026-01-15"),
          amountCents: 10000n,
          isPending: false,
          isFavorite: false,
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("updateTransaction", () => {
  it("deve atualizar apenas os campos fornecidos e definir updatedById", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      tableId: "table-1",
      sectionId: "sec-1",
      monthId: "month-1",
    } as any);
    prismaMock.transaction.update.mockResolvedValue({} as any);

    await updateTransaction(
      { transactionId: "tx-1", amountCents: 50000n, isPending: true },
      TEST_CTX,
    );

    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-1" },
        data: expect.objectContaining({
          amountCents: 50000n,
          isPending: true,
          updatedById: "user-test-1",
        }),
      }),
    );
  });

  it("não deve permitir atualizar transação de outra account (segurança multi-tenancy)", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
    } as any);

    await expect(
      updateTransaction({ transactionId: "tx-1", amountCents: 50000n }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve lançar NotFoundError se transação não existe", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(
      updateTransaction({ transactionId: "tx-inexistente", description: "Teste" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("deleteTransaction", () => {
  it("deve deletar transação existente", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      tableId: "table-1",
      sectionId: "sec-1",
      monthId: "month-1",
    } as any);
    prismaMock.transaction.delete.mockResolvedValue({} as any);

    await deleteTransaction({ transactionId: "tx-1" }, TEST_CTX);

    expect(prismaMock.transaction.delete).toHaveBeenCalledWith({ where: { id: "tx-1" } });
  });

  it("não deve permitir deletar transação de outra account (segurança multi-tenancy)", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteTransaction({ transactionId: "tx-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("duplicateTransaction", () => {
  it("deve criar cópia com os mesmos campos da transação original", async () => {
    const source = buildTransaction({
      id: "tx-source",
      accountId: "acc-test-1",
      amountCents: 25000n,
      description: "Original",
      isPending: false,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(source as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-copia-1" } as any);

    const result = await duplicateTransaction({ transactionId: "tx-source" }, TEST_CTX);

    expect(result.transactionId).toBe("tx-copia-1");
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 25000n,
          description: "Original",
          isPending: false,
          createdById: "user-test-1",
        }),
      }),
    );
  });

  it("não deve permitir duplicar transação de outra account (segurança multi-tenancy)", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      buildTransaction({ accountId: "acc-OUTRA" }) as any,
    );

    await expect(duplicateTransaction({ transactionId: "tx-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("bulkDelete", () => {
  it("deve deletar transações filtrando sempre pelo accountId do contexto", async () => {
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 2 });

    await bulkDelete({ ids: ["tx-1", "tx-2"] }, TEST_CTX);

    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-1", "tx-2"] }, accountId: "acc-test-1" },
    });
  });

  it("não deve deletar transações de outras accounts via ids cruzados", async () => {
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 0 });

    await bulkDelete({ ids: ["tx-outra-acc"] }, TEST_CTX);

    // O filtro accountId garante que só deleta da account correta
    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });
});

describe("bulkUpdate", () => {
  it("deve atualizar apenas os campos do patch fornecidos", async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 3 });

    await bulkUpdate(
      { ids: ["tx-1", "tx-2", "tx-3"], patch: { isPending: true, isFavorite: false } },
      TEST_CTX,
    );

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-1", "tx-2", "tx-3"] }, accountId: "acc-test-1" },
      data: expect.objectContaining({
        isPending: true,
        isFavorite: false,
        updatedById: "user-test-1",
      }),
    });
  });

  it("deve incluir accountId no filtro para evitar IDOR (segurança multi-tenancy)", async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 0 });

    await bulkUpdate({ ids: ["tx-qualquer"], patch: { isPending: true } }, TEST_CTX);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });
});

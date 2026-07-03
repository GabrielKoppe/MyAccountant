import { describe, expect, it } from "vitest";
import type { SectionCountType } from "@prisma/client";

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
  moveTransactions,
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

  it("deriva responsibleUserId do membro quando a party é personal (Spec 60 DD-08)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.responsibleParty.findFirst.mockResolvedValue({
      kind: "personal",
      members: [{ userId: "user-test-1" }],
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-p" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 10000n,
        isPending: false,
        isFavorite: false,
        responsiblePartyId: "party-personal-1",
      },
      TEST_CTX,
    );

    const data = (prismaMock.transaction.create.mock.calls[0][0] as any).data;
    expect(data.responsiblePartyId).toBe("party-personal-1");
    expect(data.responsibleUserId).toBe("user-test-1");
  });

  it("mantém responsibleUserId nulo quando a party é group (não é um único membro)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.responsibleParty.findFirst.mockResolvedValue({
      kind: "group",
      members: [{ userId: "u1" }, { userId: "u2" }],
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-g" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 10000n,
        isPending: false,
        isFavorite: false,
        responsiblePartyId: "party-group-1",
      },
      TEST_CTX,
    );

    const data = (prismaMock.transaction.create.mock.calls[0][0] as any).data;
    expect(data.responsiblePartyId).toBe("party-group-1");
    expect(data.responsibleUserId).toBeNull();
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
    prismaMock.transaction.findMany.mockResolvedValue([
      { monthId: "month-1" } as any,
      { monthId: "month-1" } as any,
    ]);
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 2 });

    await bulkDelete({ ids: ["tx-1", "tx-2"] }, TEST_CTX);

    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-1", "tx-2"] }, accountId: "acc-test-1" },
    });
  });

  it("não deve deletar transações de outras accounts via ids cruzados", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([{ monthId: "month-1" } as any]);
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
      {
        ids: ["tx-1", "tx-2", "tx-3"],
        monthId: "month-1",
        patch: { isPending: true, isFavorite: false },
      },
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

    await bulkUpdate(
      { ids: ["tx-qualquer"], monthId: "month-1", patch: { isPending: true } },
      TEST_CTX,
    );

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });
});

describe("expenseType — TRN-01", () => {
  it("deve criar transação com expenseType = fixed", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-fixed-1" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 50000n,
        isPending: false,
        isFavorite: false,
        expenseType: "fixed",
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expenseType: "fixed" }),
      }),
    );
  });

  it("deve criar transação com expenseType = variable", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-variable-1" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 30000n,
        isPending: false,
        isFavorite: false,
        expenseType: "variable",
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expenseType: "variable" }),
      }),
    );
  });

  it("deve criar transação com expenseType = one_time", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-onetime-1" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 80000n,
        isPending: false,
        isFavorite: false,
        expenseType: "one_time",
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expenseType: "one_time" }),
      }),
    );
  });

  it("deve criar transação com expenseType = null (não classificado)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-null-1" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 10000n,
        isPending: false,
        isFavorite: false,
        // expenseType ausente → null
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expenseType: null }),
      }),
    );
  });

  it("deve duplicar transação preservando expenseType original", async () => {
    const source = buildTransaction({
      id: "tx-source-fixed",
      accountId: "acc-test-1",
      expenseType: "fixed",
    });
    prismaMock.transaction.findUnique.mockResolvedValue(source as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-dup-1" } as any);

    await duplicateTransaction({ transactionId: "tx-source-fixed" }, TEST_CTX);

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expenseType: "fixed" }),
      }),
    );
  });

  it("deve atualizar expenseType via bulkUpdate", async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 2 });

    await bulkUpdate(
      {
        ids: ["tx-1", "tx-2"],
        monthId: "month-1",
        patch: { expenseType: "variable" },
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expenseType: "variable" }),
      }),
    );
  });
});

describe("source — TRN-03", () => {
  it("deve criar transação com source = manual por padrão", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-manual-1" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 10000n,
        isPending: false,
        isFavorite: false,
      },
      TEST_CTX,
    );

    // source = 'manual' é o default do Prisma; não precisa ser passado explicitamente
    // mas o campo não pode ser outro valor
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ source: "duplicate" }),
      }),
    );
  });

  it("deve duplicar transação com source = duplicate", async () => {
    const src = buildTransaction({ id: "tx-orig", accountId: "acc-test-1" });
    prismaMock.transaction.findUnique.mockResolvedValue(src as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-dup-src" } as any);

    await duplicateTransaction({ transactionId: "tx-orig" }, TEST_CTX);

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "duplicate" }),
      }),
    );
  });
});

describe("moveTransactions — sinal ao mover (spec 59)", () => {
  // getTableOrThrow e o fetch de nome usam o mesmo mock de financeTable.findUnique
  function mockExistingTarget(destCountType: SectionCountType) {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-dest",
      monthId: "month-dest",
      name: "Tabela Destino",
    } as any);
    prismaMock.section.findUnique.mockResolvedValue({ countType: destCountType } as any);
    // applyMove roda dentro de prisma.$transaction — executa o callback com o mock
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  }

  const dataOf = (call: any) => call[0].data as Record<string, unknown>;

  it("deve inverter amountCents (× -1) ao mover de convenção diferente com invertSign", async () => {
    mockExistingTarget("add");
    prismaMock.transaction.findMany.mockResolvedValue([
      { id: "tx-1", section: { countType: "subtract" } }, // origem subtract, destino add → difere
    ] as any);

    await moveTransactions(
      {
        ids: ["tx-1"],
        sourceMonthId: "month-src",
        invertSign: true,
        destination: { type: "existing", tableId: "table-dest" },
      },
      TEST_CTX,
    );

    const flipCall = prismaMock.transaction.updateMany.mock.calls.find(
      (c) => dataOf(c).amountCents,
    );
    expect(flipCall).toBeTruthy();
    expect(dataOf(flipCall).amountCents).toEqual({ multiply: -1 });
    expect(flipCall![0].where).toMatchObject({ id: { in: ["tx-1"] }, accountId: "acc-test-1" });
  });

  it("não deve inverter quando invertSign é false", async () => {
    mockExistingTarget("add");

    await moveTransactions(
      {
        ids: ["tx-1"],
        sourceMonthId: "month-src",
        invertSign: false,
        destination: { type: "existing", tableId: "table-dest" },
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    const calls = prismaMock.transaction.updateMany.mock.calls;
    expect(calls).toHaveLength(1);
    expect(dataOf(calls[0]).amountCents).toBeUndefined();
    expect(calls[0][0].where).toMatchObject({ accountId: "acc-test-1" });
  });

  it("não deve inverter quando convenções coincidem, mesmo com invertSign", async () => {
    mockExistingTarget("subtract");
    prismaMock.transaction.findMany.mockResolvedValue([
      { id: "tx-1", section: { countType: "subtract" } }, // ambos subtract → não difere
    ] as any);

    await moveTransactions(
      {
        ids: ["tx-1"],
        sourceMonthId: "month-src",
        invertSign: true,
        destination: { type: "existing", tableId: "table-dest" },
      },
      TEST_CTX,
    );

    const calls = prismaMock.transaction.updateMany.mock.calls;
    expect(calls.every((c) => dataOf(c).amountCents === undefined)).toBe(true);
  });

  it("deve particionar flip/keep e restringir todo update por accountId (multi-tenancy)", async () => {
    mockExistingTarget("add");
    // tx de outra conta é excluído pelo filtro accountId do findMany
    prismaMock.transaction.findMany.mockResolvedValue([
      { id: "tx-1", section: { countType: "subtract" } }, // flip
      { id: "tx-3", section: { countType: "add" } }, // keep
    ] as any);

    await moveTransactions(
      {
        ids: ["tx-1", "tx-2-outra-conta", "tx-3"],
        sourceMonthId: "month-src",
        invertSign: true,
        destination: { type: "existing", tableId: "table-dest" },
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-test-1" }) }),
    );

    const calls = prismaMock.transaction.updateMany.mock.calls;
    const flipCall = calls.find((c) => dataOf(c).amountCents);
    const keepCall = calls.find((c) => !dataOf(c).amountCents);
    expect(flipCall![0].where).toMatchObject({ id: { in: ["tx-1"] } });
    expect(keepCall![0].where).toMatchObject({ id: { in: ["tx-3"] } });
    for (const c of calls) {
      expect((c[0].where as any).accountId).toBe("acc-test-1");
      expect((c[0].where as any).id.in).not.toContain("tx-2-outra-conta");
    }
  });
});

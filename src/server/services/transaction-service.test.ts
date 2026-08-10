import type { SectionCountType } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "@/server/api/errors";

import { TEST_CTX } from "@/../tests/fixtures/account";
import { buildTransaction } from "@/../tests/fixtures/transaction";
import { prismaMock } from "@/../tests/mocks/prisma";

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

  it("grava responsiblePartyId direto do input (Spec 60 Fase 5)", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-p" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 10000n,
        isPending: false,
        isFavorite: false,
        responsiblePartyId: "party-1",
      },
      TEST_CTX,
    );

    const data = (prismaMock.transaction.create.mock.calls[0][0] as any).data;
    expect(data.responsiblePartyId).toBe("party-1");
    expect(data.responsibleUserId).toBeUndefined();
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

describe("paymentMethod — TRN-11", () => {
  it("deve criar transação com paymentMethod = pix", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-pix-1" } as any);

    await createTransaction(
      {
        tableId: "table-test-1",
        occurredOn: new Date("2026-01-15"),
        amountCents: 10000n,
        isPending: false,
        isFavorite: false,
        paymentMethod: "pix",
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: "pix" }),
      }),
    );
  });

  it("deve criar transação com paymentMethod = null quando ausente", async () => {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-pm-null" } as any);

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

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: null }),
      }),
    );
  });

  it("não deve criar com paymentMethod se a tabela é de outra account (multi-tenancy)", async () => {
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
          paymentMethod: "credit_card",
        },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it("deve atualizar paymentMethod e restringir por accountId (multi-tenancy)", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      tableId: "table-1",
      sectionId: "sec-1",
      monthId: "month-1",
    } as any);
    prismaMock.transaction.update.mockResolvedValue({} as any);

    await updateTransaction({ transactionId: "tx-1", paymentMethod: "boleto" }, TEST_CTX);

    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-1" },
        data: expect.objectContaining({ paymentMethod: "boleto", updatedById: "user-test-1" }),
      }),
    );
  });

  it("não deve atualizar paymentMethod de transação de outra account (multi-tenancy)", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      updateTransaction({ transactionId: "tx-1", paymentMethod: "pix" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it("deve definir paymentMethod = null explicitamente no update", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      tableId: "table-1",
      sectionId: "sec-1",
      monthId: "month-1",
    } as any);
    prismaMock.transaction.update.mockResolvedValue({} as any);

    await updateTransaction({ transactionId: "tx-1", paymentMethod: null }, TEST_CTX);

    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: null }),
      }),
    );
  });

  it("deve duplicar transação preservando paymentMethod original", async () => {
    const source = buildTransaction({
      id: "tx-src-pm",
      accountId: "acc-test-1",
      paymentMethod: "debit_card",
    });
    prismaMock.transaction.findUnique.mockResolvedValue(source as any);
    prismaMock.transaction.create.mockResolvedValue({ id: "tx-dup-pm" } as any);

    await duplicateTransaction({ transactionId: "tx-src-pm" }, TEST_CTX);

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: "debit_card" }),
      }),
    );
  });

  it("deve atualizar paymentMethod via bulkUpdate restringindo por accountId", async () => {
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 2 });

    await bulkUpdate(
      {
        ids: ["tx-1", "tx-2"],
        monthId: "month-1",
        patch: { paymentMethod: "bank_transfer" },
      },
      TEST_CTX,
    );

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-test-1" }),
        data: expect.objectContaining({ paymentMethod: "bank_transfer" }),
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

describe("lastUsedAt — Spec 67 §2.4 (SET-07)", () => {
  // `touchLastUsed` é fire-and-forget (`void`), mas as chamadas a `updateMany`
  // são disparadas de forma SÍNCRONA (antes do primeiro `await` do helper) —
  // por isso já estão registradas quando o service resolve.
  const TOUCH_DATA = { data: { lastUsedAt: expect.any(Date) } };

  /**
   * Entidades que o helper pode tocar a partir deste service. O cast unifica os
   * tipos de `updateMany` (um por entidade) num só — o teste só olha a lista de
   * chamadas, não a assinatura.
   */
  const touchDelegates = () =>
    [
      prismaMock.category.updateMany,
      prismaMock.subcategory.updateMany,
      prismaMock.institution.updateMany,
      prismaMock.responsibleParty.updateMany,
      prismaMock.section.updateMany,
    ] as unknown as Array<typeof prismaMock.section.updateMany>;

  beforeEach(() => {
    // Resolver explicitamente evita que o `Promise.all` interno do helper fique
    // pendurado em algum retorno de deep mock.
    for (const delegate of touchDelegates()) delegate.mockResolvedValue({ count: 1 });
  });

  function mockTableFound() {
    prismaMock.financeTable.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      sectionId: "sec-test-1",
      monthId: "month-test-1",
    } as any);
  }

  /** Todo toque é escrita — o `where` SEMPRE carrega `accountId` (multi-tenancy). */
  function expectTouched(delegate: unknown, ids: string[]) {
    expect(delegate).toHaveBeenCalledWith({
      where: { id: { in: ids }, accountId: "acc-test-1" },
      ...TOUCH_DATA,
    });
  }

  describe("createTransaction", () => {
    it("toca categoria, subcategoria, instituição e responsável do input", async () => {
      mockTableFound();
      prismaMock.transaction.create.mockResolvedValue({ id: "tx-touch-1" } as any);

      await createTransaction(
        {
          tableId: "table-test-1",
          occurredOn: new Date("2026-01-15"),
          amountCents: 10000n,
          isPending: false,
          isFavorite: false,
          categoryId: "cat-1",
          subcategoryId: "sub-1",
          institutionId: "inst-1",
          responsiblePartyId: "party-1",
        },
        TEST_CTX,
      );

      expectTouched(prismaMock.category.updateMany, ["cat-1"]);
      expectTouched(prismaMock.subcategory.updateMany, ["sub-1"]);
      expectTouched(prismaMock.institution.updateMany, ["inst-1"]);
      expectTouched(prismaMock.responsibleParty.updateMany, ["party-1"]);
    });

    it("não toca entidade cujo id não veio no input", async () => {
      mockTableFound();
      prismaMock.transaction.create.mockResolvedValue({ id: "tx-touch-2" } as any);

      await createTransaction(
        {
          tableId: "table-test-1",
          occurredOn: new Date("2026-01-15"),
          amountCents: 10000n,
          isPending: false,
          isFavorite: false,
          categoryId: "cat-1",
        },
        TEST_CTX,
      );

      expectTouched(prismaMock.category.updateMany, ["cat-1"]);
      expect(prismaMock.subcategory.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.institution.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.responsibleParty.updateMany).not.toHaveBeenCalled();
    });

    it("não toca nada quando a tabela é de outra account (multi-tenancy)", async () => {
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
            categoryId: "cat-de-outra-conta",
          },
          TEST_CTX,
        ),
      ).rejects.toThrow(NotFoundError);

      for (const delegate of touchDelegates()) expect(delegate).not.toHaveBeenCalled();
    });
  });

  describe("updateTransaction", () => {
    function mockOwnedTransaction() {
      prismaMock.transaction.findUnique.mockResolvedValue({
        accountId: "acc-test-1",
        tableId: "table-1",
        sectionId: "sec-1",
        monthId: "month-1",
      } as any);
      prismaMock.transaction.update.mockResolvedValue({} as any);
    }

    it("toca SOMENTE as entidades cujo campo veio no patch parcial", async () => {
      mockOwnedTransaction();

      await updateTransaction(
        { transactionId: "tx-1", categoryId: "cat-nova", isPending: true },
        TEST_CTX,
      );

      expectTouched(prismaMock.category.updateMany, ["cat-nova"]);
      // subcategoria/instituição/responsável continuam gravados na transação,
      // mas ninguém os escolheu agora — tocá-los seria mentira sobre o uso.
      expect(prismaMock.subcategory.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.institution.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.responsibleParty.updateMany).not.toHaveBeenCalled();
    });

    it("não toca nada quando o patch limpa o campo (id null)", async () => {
      mockOwnedTransaction();

      await updateTransaction({ transactionId: "tx-1", categoryId: null }, TEST_CTX);

      expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
    });

    it("não toca nada quando o patch não traz nenhuma referência", async () => {
      mockOwnedTransaction();

      await updateTransaction({ transactionId: "tx-1", amountCents: 50000n }, TEST_CTX);

      for (const delegate of touchDelegates()) expect(delegate).not.toHaveBeenCalled();
    });

    it("não toca nada quando a transação é de outra account (multi-tenancy)", async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

      await expect(
        updateTransaction({ transactionId: "tx-1", categoryId: "cat-1" }, TEST_CTX),
      ).rejects.toThrow(NotFoundError);

      for (const delegate of touchDelegates()) expect(delegate).not.toHaveBeenCalled();
    });
  });

  describe("duplicateTransaction", () => {
    it("toca as 4 entidades copiadas da origem", async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(
        buildTransaction({
          id: "tx-src",
          accountId: "acc-test-1",
          categoryId: "cat-1",
          subcategoryId: "sub-1",
          institutionId: "inst-1",
          responsiblePartyId: "party-1",
        }) as any,
      );
      prismaMock.transaction.create.mockResolvedValue({ id: "tx-dup" } as any);

      await duplicateTransaction({ transactionId: "tx-src" }, TEST_CTX);

      expectTouched(prismaMock.category.updateMany, ["cat-1"]);
      expectTouched(prismaMock.subcategory.updateMany, ["sub-1"]);
      expectTouched(prismaMock.institution.updateMany, ["inst-1"]);
      expectTouched(prismaMock.responsibleParty.updateMany, ["party-1"]);
    });

    it("não toca nada ao duplicar transação de outra account (multi-tenancy)", async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(
        buildTransaction({ accountId: "acc-OUTRA", categoryId: "cat-1" }) as any,
      );

      await expect(duplicateTransaction({ transactionId: "tx-1" }, TEST_CTX)).rejects.toThrow(
        NotFoundError,
      );

      for (const delegate of touchDelegates()) expect(delegate).not.toHaveBeenCalled();
    });
  });

  describe("bulkUpdate", () => {
    it("toca categoria e instituição do patch em massa, restrito por accountId", async () => {
      prismaMock.transaction.updateMany.mockResolvedValue({ count: 2 });

      await bulkUpdate(
        {
          ids: ["tx-1", "tx-2"],
          monthId: "month-1",
          patch: { categoryId: "cat-massa", institutionId: "inst-massa" },
        },
        TEST_CTX,
      );

      expectTouched(prismaMock.category.updateMany, ["cat-massa"]);
      expectTouched(prismaMock.institution.updateMany, ["inst-massa"]);
      // bulkUpdate não grava subcategoria nem responsável
      expect(prismaMock.subcategory.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.responsibleParty.updateMany).not.toHaveBeenCalled();
    });

    it("não toca nada quando o patch em massa não traz referências", async () => {
      prismaMock.transaction.updateMany.mockResolvedValue({ count: 2 });

      await bulkUpdate({ ids: ["tx-1"], monthId: "month-1", patch: { isPending: true } }, TEST_CTX);

      for (const delegate of touchDelegates()) expect(delegate).not.toHaveBeenCalled();
    });
  });

  describe("moveTransactions", () => {
    it("toca a seção de DESTINO ao mover para tabela existente", async () => {
      prismaMock.financeTable.findUnique.mockResolvedValue({
        accountId: "acc-test-1",
        sectionId: "sec-dest",
        monthId: "month-dest",
        name: "Tabela Destino",
      } as any);
      prismaMock.section.findUnique.mockResolvedValue({ countType: "add" } as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));

      await moveTransactions(
        {
          ids: ["tx-1"],
          sourceMonthId: "month-src",
          invertSign: false,
          destination: { type: "existing", tableId: "table-dest" },
        },
        TEST_CTX,
      );

      expectTouched(prismaMock.section.updateMany, ["sec-dest"]);
    });

    it("toca a seção de DESTINO ao mover para tabela nova", async () => {
      prismaMock.month.findFirst.mockResolvedValue({ id: "month-dest" } as any);
      prismaMock.section.findFirst.mockResolvedValue({ id: "sec-dest" } as any);
      prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
      prismaMock.transaction.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.financeTable.count.mockResolvedValue(0);
      prismaMock.financeTable.create.mockResolvedValue({
        id: "table-nova",
        name: "Nova",
      } as any);

      await moveTransactions(
        {
          ids: ["tx-1"],
          sourceMonthId: "month-src",
          invertSign: false,
          destination: {
            type: "new",
            monthId: "month-dest",
            sectionId: "sec-dest",
            tableTypeId: "tt-1",
            name: "Nova",
            countInMonth: true,
          },
        },
        TEST_CTX,
      );

      expectTouched(prismaMock.section.updateMany, ["sec-dest"]);
    });
  });

  describe("exclusão não é uso", () => {
    it("deleteTransaction NÃO toca nenhuma entidade", async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        accountId: "acc-test-1",
        monthId: "month-1",
        installmentGroupId: null,
        installmentNumber: null,
        categoryId: "cat-1",
        subcategoryId: "sub-1",
      } as any);
      prismaMock.transaction.delete.mockResolvedValue({} as any);

      await deleteTransaction({ transactionId: "tx-1" }, TEST_CTX);

      for (const delegate of touchDelegates()) expect(delegate).not.toHaveBeenCalled();
    });

    it("bulkDelete NÃO toca nenhuma entidade", async () => {
      prismaMock.transaction.findMany.mockResolvedValue([{ monthId: "month-1" } as any]);
      prismaMock.transaction.deleteMany.mockResolvedValue({ count: 1 });

      await bulkDelete({ ids: ["tx-1", "tx-2"] }, TEST_CTX);

      for (const delegate of touchDelegates()) expect(delegate).not.toHaveBeenCalled();
    });
  });
});

import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/server/api/errors";

import { TEST_CTX } from "@/../tests/fixtures/account";
import { prismaMock } from "@/../tests/mocks/prisma";

import {
  createChecklistItem,
  deleteChecklistItem,
  linkChecklistTransaction,
  listChecklistForMonth,
  listChecklistItems,
  reorderChecklist,
  toggleChecklistCompletion,
  unlinkChecklistTransaction,
  updateChecklistItem,
} from "./checklist-service";

describe("listChecklistItems", () => {
  it("deve listar itens da account ordenados por position", async () => {
    prismaMock.checklistItem.findMany.mockResolvedValue([
      { id: "item-1", label: "Pagar aluguel", position: 0 } as any,
    ]);

    const items = await listChecklistItems("acc-test-1");

    expect(items).toHaveLength(1);
    expect(prismaMock.checklistItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1" },
        orderBy: { position: "asc" },
      }),
    );
  });
});

describe("listChecklistForMonth — multi-tenancy", () => {
  it("deve lançar NotFoundError se o mês pertence a outra account", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(listChecklistForMonth("acc-test-1", "month-1")).rejects.toThrow(NotFoundError);
  });

  it("deve mapear conclusão presente como done=true e ausente como done=false", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        label: "Feito",
        position: 0,
        completions: [
          {
            completedById: "user-x",
            createdAt: new Date("2026-07-01"),
            completedBy: { name: "Ana" },
          },
        ],
      },
      { id: "item-2", label: "Pendente", position: 1, completions: [] },
    ] as any);

    const items = await listChecklistForMonth("acc-test-1", "month-1");

    expect(items[0]).toMatchObject({ id: "item-1", done: true, completedByName: "Ana" });
    expect(items[1]).toMatchObject({ id: "item-2", done: false });
    // Só as conclusões do mês pedido devem ser buscadas.
    expect(prismaMock.checklistItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1" },
        orderBy: { position: "asc" },
      }),
    );
  });

  it("deve mapear a transação vinculada incluindo occurredOn (YYYY-MM-DD)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        label: "Aluguel",
        position: 0,
        completions: [
          {
            completedById: "user-x",
            createdAt: new Date("2026-07-01"),
            completedBy: { name: "Ana" },
            transaction: {
              id: "tx-1",
              description: "Aluguel julho",
              amountCents: 150000n,
              occurredOn: new Date("2026-07-03"),
            },
          },
        ],
      },
    ] as any);

    const items = await listChecklistForMonth("acc-test-1", "month-1");

    expect(items[0].linkedTransaction).toEqual({
      id: "tx-1",
      description: "Aluguel julho",
      amountCents: "150000",
      occurredOn: "2026-07-03",
    });
  });
});

describe("createChecklistItem", () => {
  it("deve criar item com position = max+1 e scoped à account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue(null);
    prismaMock.checklistItem.findFirst.mockResolvedValue({ position: 4 } as any);
    prismaMock.checklistItem.create.mockResolvedValue({ id: "item-new" } as any);

    const result = await createChecklistItem({ label: "Nova tarefa" }, TEST_CTX);

    expect(result.itemId).toBe("item-new");
    expect(prismaMock.checklistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          label: "Nova tarefa",
          position: 5,
          createdById: "user-test-1",
        }),
      }),
    );
  });

  it("deve usar position 0 quando não há itens", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue(null);
    prismaMock.checklistItem.findFirst.mockResolvedValue(null);
    prismaMock.checklistItem.create.mockResolvedValue({ id: "item-new" } as any);

    await createChecklistItem({ label: "Primeira" }, TEST_CTX);

    expect(prismaMock.checklistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: 0 }) }),
    );
  });

  it("deve lançar ConflictError em label duplicado", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ id: "item-existente" } as any);

    await expect(createChecklistItem({ label: "Repetida" }, TEST_CTX)).rejects.toThrow(
      ConflictError,
    );
  });
});

describe("updateChecklistItem — multi-tenancy", () => {
  it("deve lançar NotFoundError se o item pertence a outra account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(updateChecklistItem({ itemId: "item-1", label: "X" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("deve lançar ConflictError se outro item já tem o label", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistItem.findFirst.mockResolvedValue({ id: "item-2" } as any);

    await expect(
      updateChecklistItem({ itemId: "item-1", label: "Duplicada" }, TEST_CTX),
    ).rejects.toThrow(ConflictError);
  });

  it("deve renomear o item", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistItem.findFirst.mockResolvedValue(null);
    prismaMock.checklistItem.update.mockResolvedValue({} as any);

    await updateChecklistItem({ itemId: "item-1", label: "Novo nome" }, TEST_CTX);

    expect(prismaMock.checklistItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { label: "Novo nome" },
    });
  });
});

describe("deleteChecklistItem — multi-tenancy", () => {
  it("deve lançar NotFoundError se o item pertence a outra account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteChecklistItem({ itemId: "item-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("deve deletar o item", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistItem.delete.mockResolvedValue({} as any);

    await deleteChecklistItem({ itemId: "item-1" }, TEST_CTX);

    expect(prismaMock.checklistItem.delete).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });
});

describe("reorderChecklist — multi-tenancy", () => {
  it("deve lançar NotFoundError se algum id não pertence à account", async () => {
    prismaMock.checklistItem.findMany.mockResolvedValue([{ id: "item-1" }] as any); // 1 de 2

    await expect(reorderChecklist({ orderedIds: ["item-1", "item-2"] }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("deve atualizar as positions na ordem recebida", async () => {
    prismaMock.checklistItem.findMany.mockResolvedValue([
      { id: "item-1" },
      { id: "item-2" },
    ] as any);
    prismaMock.$transaction.mockResolvedValue([] as any);

    await reorderChecklist({ orderedIds: ["item-2", "item-1"] }, TEST_CTX);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.checklistItem.update).toHaveBeenCalledWith({
      where: { id: "item-2" },
      data: { position: 0 },
    });
    expect(prismaMock.checklistItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { position: 1 },
    });
  });
});

describe("toggleChecklistCompletion — write-time tenant guard", () => {
  it("deve lançar NotFoundError se o item pertence a outra account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);

    await expect(
      toggleChecklistCompletion({ itemId: "item-1", monthId: "month-1", done: true }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
    expect(prismaMock.checklistCompletion.upsert).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError se o mês (forjado) pertence a outra account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      toggleChecklistCompletion({ itemId: "item-1", monthId: "month-1", done: true }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
    expect(prismaMock.checklistCompletion.upsert).not.toHaveBeenCalled();
  });

  it("done=true deve fazer upsert idempotente com accountId + completedById", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistCompletion.upsert.mockResolvedValue({} as any);

    await toggleChecklistCompletion({ itemId: "item-1", monthId: "month-1", done: true }, TEST_CTX);

    expect(prismaMock.checklistCompletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemId_monthId: { itemId: "item-1", monthId: "month-1" } },
        create: {
          accountId: "acc-test-1",
          itemId: "item-1",
          monthId: "month-1",
          completedById: "user-test-1",
        },
        update: {},
      }),
    );
  });

  it("done=false deve deletar a conclusão (scoped à account)", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistCompletion.deleteMany.mockResolvedValue({ count: 1 } as any);

    await toggleChecklistCompletion(
      { itemId: "item-1", monthId: "month-1", done: false },
      TEST_CTX,
    );

    expect(prismaMock.checklistCompletion.deleteMany).toHaveBeenCalledWith({
      where: { itemId: "item-1", monthId: "month-1", accountId: "acc-test-1" },
    });
    expect(prismaMock.checklistCompletion.upsert).not.toHaveBeenCalled();
  });
});

describe("linkChecklistTransaction — write-time tenant guard", () => {
  it("deve lançar NotFoundError se o item pertence a outra account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);

    await expect(
      linkChecklistTransaction(
        { itemId: "item-1", monthId: "month-1", transactionId: "tx-1" },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
    expect(prismaMock.checklistCompletion.upsert).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError se a transação é de outra account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-OUTRA",
      monthId: "month-1",
    } as any);

    await expect(
      linkChecklistTransaction(
        { itemId: "item-1", monthId: "month-1", transactionId: "tx-1" },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
    expect(prismaMock.checklistCompletion.upsert).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError se a transação é de outro mês", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      monthId: "month-OUTRO",
    } as any);

    await expect(
      linkChecklistTransaction(
        { itemId: "item-1", monthId: "month-1", transactionId: "tx-1" },
        TEST_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve fazer upsert marcando concluído + transactionId + completedById", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.transaction.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      monthId: "month-1",
    } as any);
    prismaMock.checklistCompletion.upsert.mockResolvedValue({} as any);

    await linkChecklistTransaction(
      { itemId: "item-1", monthId: "month-1", transactionId: "tx-1" },
      TEST_CTX,
    );

    expect(prismaMock.checklistCompletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { itemId_monthId: { itemId: "item-1", monthId: "month-1" } },
        create: {
          accountId: "acc-test-1",
          itemId: "item-1",
          monthId: "month-1",
          completedById: "user-test-1",
          transactionId: "tx-1",
        },
        update: { transactionId: "tx-1" },
      }),
    );
  });
});

describe("unlinkChecklistTransaction", () => {
  it("deve lançar NotFoundError se o item pertence a outra account", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(
      unlinkChecklistTransaction({ itemId: "item-1", monthId: "month-1" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve zerar transactionId mantendo a conclusão (scoped à account)", async () => {
    prismaMock.checklistItem.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.checklistCompletion.updateMany.mockResolvedValue({ count: 1 } as any);

    await unlinkChecklistTransaction({ itemId: "item-1", monthId: "month-1" }, TEST_CTX);

    expect(prismaMock.checklistCompletion.updateMany).toHaveBeenCalledWith({
      where: { itemId: "item-1", monthId: "month-1", accountId: "acc-test-1" },
      data: { transactionId: null },
    });
  });
});

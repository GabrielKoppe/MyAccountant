import { describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { ConflictError } from "@/server/api/errors";

import { createAccount } from "./account-service";

const INPUT = { name: "Conta Pessoal", createdById: "user-test-1" };

function makeTxMock() {
  return {
    account: {
      create: vi.fn().mockResolvedValue({ id: "acc-new-1", name: INPUT.name }),
    },
    category: {
      create: vi.fn().mockResolvedValue({ id: "cat-1" }),
    },
  };
}

describe("createAccount", () => {
  it("cria account e retorna id + nome", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    const result = await createAccount(INPUT);

    expect(result).toEqual({ id: "acc-new-1", name: INPUT.name });
  });

  it("chama account.create com nome e createdById corretos", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    await createAccount(INPUT);

    expect(txMock.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Conta Pessoal",
          createdById: "user-test-1",
        }),
      }),
    );
  });

  it("vincula o criador como membro owner", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    await createAccount(INPUT);

    expect(txMock.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          members: { create: { userId: "user-test-1", role: "owner" } },
        }),
      }),
    );
  });

  it("cria 3 tipos de tabela padrão em createMany", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    await createAccount(INPUT);

    const callData = txMock.account.create.mock.calls[0][0].data;
    expect(callData.tableTypes.createMany.data).toHaveLength(3);
    const typeNames = callData.tableTypes.createMany.data.map((tt: { name: string }) => tt.name);
    expect(typeNames).toContain("Manual");
    expect(typeNames).toContain("Cartão de crédito");
    expect(typeNames).toContain("Investimentos");
  });

  it("cria 4 seções padrão em createMany", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    await createAccount(INPUT);

    const callData = txMock.account.create.mock.calls[0][0].data;
    expect(callData.sections.createMany.data).toHaveLength(4);
    const sectionNames = callData.sections.createMany.data.map((s: { name: string }) => s.name);
    expect(sectionNames).toContain("Entradas");
    expect(sectionNames).toContain("Saídas");
  });

  it("cria settings com BRL e monthStartDay=1", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    await createAccount(INPUT);

    const callData = txMock.account.create.mock.calls[0][0].data;
    expect(callData.settings.create).toMatchObject({ currency: "BRL", monthStartDay: 1 });
  });

  it("cria 5 categorias padrão via category.create na transaction", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    await createAccount(INPUT);

    expect(txMock.category.create).toHaveBeenCalledTimes(5);
  });

  it("cada categoria criada pertence à nova account e ao criador", async () => {
    const txMock = makeTxMock();
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    await createAccount(INPUT);

    for (const call of txMock.category.create.mock.calls) {
      expect(call[0].data.accountId).toBe("acc-new-1");
      expect(call[0].data.createdById).toBe("user-test-1");
    }
  });

  it("lança ConflictError se já existe account com o mesmo nome para o usuário", async () => {
    prismaMock.account.findFirst.mockResolvedValue({ id: "acc-existente" } as any);

    await expect(createAccount(INPUT)).rejects.toThrow(ConflictError);
  });

  it("verifica duplicata filtrando por nome E pelo userId do criador", async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(makeTxMock()));

    await createAccount(INPUT);

    expect(prismaMock.account.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          name: "Conta Pessoal",
          members: { some: { userId: "user-test-1" } },
        },
      }),
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { ConflictError, NotFoundError } from "@/server/api/errors";

import { csvImportService } from "./csv-import-service";

// Minimal mapping — importMappingSchema.parse() fills in defaults
const MAPPING = { columns: { date: "Data", amount: "Valor" } };

const VALID_ROWS = [{ Data: "03/01/2026", Valor: "100,00" }];

const EXEC_CTX = { accountId: "acc-test-1", userId: "user-test-1" };

const EXEC_INPUT = {
  monthId: "month-1",
  sectionId: "sec-1",
  tableTypeId: "tt-1",
  tableName: "Importação Janeiro",
  countInMonth: true,
  mapping: MAPPING,
  rows: VALID_ROWS,
};

function setupFoundResources() {
  prismaMock.month.findFirst.mockResolvedValue({
    id: "month-1",
    year: 2026,
    month: 1,
    accountId: "acc-test-1",
  } as any);
  prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
  prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
  prismaMock.category.findMany.mockResolvedValue([]);
  prismaMock.subcategory.findMany.mockResolvedValue([]);
  prismaMock.institution.findMany.mockResolvedValue([]);
  prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
}

function setupTxMock() {
  const txMock = {
    financeTable: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "table-imported-1" }),
    },
    transaction: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));
  return txMock;
}

describe("executeImport", () => {
  it("retorna tableId, imported e errors corretos para linhas válidas", async () => {
    setupFoundResources();
    const txMock = setupTxMock();

    const result = await csvImportService.executeImport(EXEC_INPUT as any, EXEC_CTX);

    expect(result.tableId).toBe("table-imported-1");
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(txMock.transaction.createMany).toHaveBeenCalledOnce();
  });

  it("cria a tabela com accountId correto (nunca vaza para outra account)", async () => {
    setupFoundResources();
    const txMock = setupTxMock();

    await csvImportService.executeImport(EXEC_INPUT as any, EXEC_CTX);

    expect(txMock.financeTable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });

  it("inclui accountId em todas as transações criadas", async () => {
    setupFoundResources();
    const txMock = setupTxMock();

    await csvImportService.executeImport(EXEC_INPUT as any, EXEC_CTX);

    const txData = txMock.transaction.createMany.mock.calls[0][0].data;
    for (const tx of txData) {
      expect(tx.accountId).toBe("acc-test-1");
    }
  });

  it("registra erros de linhas inválidas sem interromper o import", async () => {
    setupFoundResources();
    setupTxMock();

    const inputWithErrors = {
      ...EXEC_INPUT,
      rows: [
        { Data: "invalida", Valor: "100,00" }, // erro de data
        { Data: "03/01/2026", Valor: "200,00" }, // ok
      ],
    };

    const result = await csvImportService.executeImport(inputWithErrors as any, EXEC_CTX);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rowIndex).toBe(0);
  });

  it("contabiliza linhas ignoradas em skipped", async () => {
    setupFoundResources();
    setupTxMock();

    const inputWithEmpty = {
      ...EXEC_INPUT,
      mapping: { columns: { date: "Data", amount: "Valor" }, ignoreEmptyRows: true },
      rows: [
        { Data: "", Valor: "" }, // linha vazia → ignored
        { Data: "03/01/2026", Valor: "100,00" }, // ok
      ],
    };

    const result = await csvImportService.executeImport(inputWithEmpty as any, EXEC_CTX);

    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(1);
  });

  it("pula linhas válidas marcadas manualmente em manualIgnoreRows", async () => {
    setupFoundResources();
    const txMock = setupTxMock();

    const input = {
      ...EXEC_INPUT,
      rows: [
        { Data: "03/01/2026", Valor: "100,00" }, // rowIndex 0 — ignorada manualmente
        { Data: "04/01/2026", Valor: "200,00" }, // rowIndex 1 — importada
      ],
      manualIgnoreRows: [0],
    };

    const result = await csvImportService.executeImport(input as any, EXEC_CTX);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
    // só a linha não-ignorada vira transação
    const createManyArg = txMock.transaction.createMany.mock.calls[0][0];
    expect(createManyArg.data).toHaveLength(1);
    expect(createManyArg.data[0].amountCents).toBe(20000n);
  });

  it("lança NotFoundError quando mês pertence a outra account (multi-tenancy)", async () => {
    prismaMock.month.findFirst.mockResolvedValue(null); // month.findFirst com accountId filtra corretamente
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);

    await expect(csvImportService.executeImport(EXEC_INPUT as any, EXEC_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("lança NotFoundError quando seção pertence a outra account (multi-tenancy)", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.section.findFirst.mockResolvedValue(null);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);

    await expect(csvImportService.executeImport(EXEC_INPUT as any, EXEC_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("não chama $transaction quando recursos não são encontrados", async () => {
    prismaMock.month.findFirst.mockResolvedValue(null);
    prismaMock.section.findFirst.mockResolvedValue(null);
    prismaMock.tableType.findFirst.mockResolvedValue(null);

    await expect(csvImportService.executeImport(EXEC_INPUT as any, EXEC_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("createTemplate", () => {
  const TPL_CTX = { accountId: "acc-test-1", userId: "user-test-1" };
  const INPUT = { name: "Extrato Banco X", mapping: MAPPING };

  it("cria template com accountId e createdById corretos", async () => {
    prismaMock.csvTemplate.findFirst.mockResolvedValue(null);
    prismaMock.csvTemplate.create.mockResolvedValue({
      id: "csv-tpl-1",
      name: "Extrato Banco X",
    } as any);

    await csvImportService.createTemplate(INPUT as any, TPL_CTX);

    expect(prismaMock.csvTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          createdById: "user-test-1",
          name: "Extrato Banco X",
        }),
      }),
    );
  });

  it("lança ConflictError quando nome já existe na account", async () => {
    prismaMock.csvTemplate.findFirst.mockResolvedValue({ id: "csv-tpl-existing" } as any);

    await expect(csvImportService.createTemplate(INPUT as any, TPL_CTX)).rejects.toThrow(
      ConflictError,
    );
  });
});

describe("updateTemplate", () => {
  const UPDATE_CTX = { accountId: "acc-test-1" };

  it("lança NotFoundError quando template pertence a outra account (multi-tenancy)", async () => {
    prismaMock.csvTemplate.findFirst.mockResolvedValue(null);

    await expect(
      csvImportService.updateTemplate(
        { templateId: "cljk3d4e500001abcdefgh1234", name: "Novo nome" },
        UPDATE_CTX,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("atualiza template quando encontrado na account", async () => {
    prismaMock.csvTemplate.findFirst.mockResolvedValue({ id: "csv-tpl-1" } as any);
    prismaMock.csvTemplate.update.mockResolvedValue({ id: "csv-tpl-1", name: "Novo nome" } as any);

    await csvImportService.updateTemplate(
      { templateId: "cljk3d4e500001abcdefgh1234", name: "Novo nome" },
      UPDATE_CTX,
    );

    expect(prismaMock.csvTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Novo nome" }),
      }),
    );
  });

  it("busca template filtrando por templateId E accountId antes de atualizar", async () => {
    prismaMock.csvTemplate.findFirst.mockResolvedValue({ id: "csv-tpl-1" } as any);
    prismaMock.csvTemplate.update.mockResolvedValue({ id: "csv-tpl-1", name: "Novo nome" } as any);

    await csvImportService.updateTemplate(
      { templateId: "csv-tpl-1", name: "Novo nome" },
      UPDATE_CTX,
    );

    expect(prismaMock.csvTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "csv-tpl-1", accountId: "acc-test-1" },
      }),
    );
  });
});

describe("listTemplates", () => {
  it("filtra templates pelo accountId", async () => {
    prismaMock.csvTemplate.findMany.mockResolvedValue([]);

    await csvImportService.listTemplates("acc-test-1");

    expect(prismaMock.csvTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acc-test-1" } }),
    );
  });
});

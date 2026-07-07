import { describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "@/server/api/errors";

import { prismaMock } from "@/../tests/mocks/prisma";

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
  prismaMock.transactionAlias.findMany.mockResolvedValue([]);
}

function setupTxMock() {
  const txMock = {
    financeTable: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "table-imported-1" }),
    },
    transaction: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    transactionTag: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
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

describe("executeImport — apelidos (spec 61 Fase 5)", () => {
  const ALIAS_MAPPING = { columns: { date: "Data", amount: "Valor", description: "Desc" } };

  function mkAliasRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: "alias-1",
      trigger: "CEG",
      triggerNormalized: "ceg",
      description: null,
      notes: null,
      amountCents: 999999n, // DD-09: nunca aplicado no import — deve ser ignorado
      categoryId: "cat-alias-1",
      category: { name: "Conta" },
      subcategoryId: null,
      subcategory: null,
      institutionId: null,
      institution: null,
      institutionText: null,
      responsiblePartyId: null,
      responsibleParty: null,
      expenseType: null,
      paymentMethod: null,
      investmentType: null,
      cardInstallment: null,
      isPending: null,
      isFavorite: null,
      originalCurrency: null,
      originalAmountCents: null,
      exchangeRate: null,
      archivedAt: null,
      createdById: "user-test-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      tags: [],
      ...overrides,
    };
  }

  function setupFoundResourcesWithAlias(overrides: Record<string, unknown> = {}) {
    setupFoundResources();
    prismaMock.transactionAlias.findMany.mockResolvedValue([mkAliasRecord(overrides)] as any);
  }

  it("recarrega apelidos filtrando pela account (multi-tenancy)", async () => {
    setupFoundResourcesWithAlias();
    setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: ALIAS_MAPPING,
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
      } as any,
      EXEC_CTX,
    );

    expect(prismaMock.transactionAlias.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acc-test-1", archivedAt: null } }),
    );
  });

  it("apelido casado sobrescreve a categoria resolvida do CSV (DD-17)", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.category.findMany.mockResolvedValue([{ id: "cat-csv-1", name: "Casa" } as any]);
    prismaMock.subcategory.findMany.mockResolvedValue([]);
    prismaMock.institution.findMany.mockResolvedValue([]);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
    prismaMock.transactionAlias.findMany.mockResolvedValue([mkAliasRecord()] as any);
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: { ...ALIAS_MAPPING, columns: { ...ALIAS_MAPPING.columns, category: "Cat" } },
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG", Cat: "Casa" }],
      } as any,
      EXEC_CTX,
    );

    expect(txMock.transaction.createMany.mock.calls[0][0].data[0].categoryId).toBe("cat-alias-1");
  });

  it("aplica favorito e preenche moeda estrangeira quando o extrato não traz FX (DD-22)", async () => {
    setupFoundResourcesWithAlias({
      isFavorite: true,
      originalCurrency: "USD",
      originalAmountCents: 1299n,
      exchangeRate: { toNumber: () => 5.12 },
    });
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: ALIAS_MAPPING,
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
      } as any,
      EXEC_CTX,
    );

    const created = txMock.transaction.createMany.mock.calls[0][0].data[0];
    expect(created.isFavorite).toBe(true);
    expect(created.originalCurrency).toBe("USD");
    expect(created.originalAmountCents).toBe(1299n);
    expect(created.exchangeRate).toBe(5.12);
  });

  it("não sobrescreve a moeda estrangeira do extrato pela do apelido (DD-22 fill-if-empty)", async () => {
    setupFoundResourcesWithAlias({
      originalCurrency: "USD",
      originalAmountCents: 1299n,
      exchangeRate: { toNumber: () => 5.12 },
    });
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: {
          ...ALIAS_MAPPING,
          columns: { ...ALIAS_MAPPING.columns, fxCurrency: "Moeda", fxAmount: "ValorOrig" },
        },
        rows: [
          {
            Data: "03/01/2026",
            Valor: "100,00",
            Desc: "pagamento CEG",
            Moeda: "EUR",
            ValorOrig: "50,00",
          },
        ],
      } as any,
      EXEC_CTX,
    );

    // extrato trouxe FX próprio → prevalece; a moeda do apelido (USD) é ignorada.
    const created = txMock.transaction.createMany.mock.calls[0][0].data[0];
    expect(created.originalCurrency).toBe("EUR");
  });

  it("apelido com institutionId sobrescreve a instituição resolvida do CSV, limpando institutionText (DD-17/DD-14)", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.category.findMany.mockResolvedValue([]);
    prismaMock.subcategory.findMany.mockResolvedValue([]);
    prismaMock.institution.findMany.mockResolvedValue([
      { id: "inst-csv-1", name: "Banco X" } as any,
    ]);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
    prismaMock.transactionAlias.findMany.mockResolvedValue([
      mkAliasRecord({ institutionId: "inst-alias-1", institution: { name: "Corretora Y" } }),
    ] as any);
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: { ...ALIAS_MAPPING, columns: { ...ALIAS_MAPPING.columns, institution: "Inst" } },
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG", Inst: "Banco X" }],
      } as any,
      EXEC_CTX,
    );

    const created = txMock.transaction.createMany.mock.calls[0][0].data[0];
    expect(created.institutionId).toBe("inst-alias-1");
    expect(created.institutionText).toBeNull();
  });

  it("subcategoryId explícito do apelido vence mesmo quando a subcategoria do CSV ainda seria filha da categoria nova (DD-18)", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.category.findMany.mockResolvedValue([{ id: "cat-alias-1", name: "Conta" } as any]);
    prismaMock.subcategory.findMany.mockResolvedValue([
      { id: "sub-csv", name: "Água", categoryId: "cat-alias-1" } as any,
    ]);
    prismaMock.institution.findMany.mockResolvedValue([]);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
    prismaMock.transactionAlias.findMany.mockResolvedValue([
      mkAliasRecord({ subcategoryId: "sub-alias", subcategory: { name: "Gás" } }),
    ] as any);
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: {
          ...ALIAS_MAPPING,
          columns: { ...ALIAS_MAPPING.columns, category: "Cat", subcategory: "Sub" },
        },
        rows: [
          { Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG", Cat: "Conta", Sub: "Água" },
        ],
      } as any,
      EXEC_CTX,
    );

    // subcategoryId explícito do apelido tem prioridade sobre o resolvido do CSV,
    // mesmo "sub-csv" ainda sendo filha válida de "cat-alias-1".
    expect(txMock.transaction.createMany.mock.calls[0][0].data[0].subcategoryId).toBe("sub-alias");
  });

  it("amountCents do apelido NUNCA é aplicado no import (DD-09)", async () => {
    setupFoundResourcesWithAlias();
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: ALIAS_MAPPING,
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
      } as any,
      EXEC_CTX,
    );

    // valor do extrato (100,00 → 10000n), nunca o amountCents do apelido (999999n)
    expect(txMock.transaction.createMany.mock.calls[0][0].data[0].amountCents).toBe(10000n);
  });

  it("opt-out por linha via aliasIgnoreRows não aplica o apelido (DD-16)", async () => {
    setupFoundResourcesWithAlias();
    const txMock = setupTxMock();

    const result = await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: ALIAS_MAPPING,
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
        aliasIgnoreRows: [0],
      } as any,
      EXEC_CTX,
    );

    expect(result.imported).toBe(1); // linha ainda é importada — só sem o payload do apelido
    const created = txMock.transaction.createMany.mock.calls[0][0].data[0];
    expect(created.categoryId).toBeNull();
    expect(created.metadata).toEqual({});
  });

  it("limpa subcategoria órfã quando o apelido troca a categoria sem definir subcategoria (DD-18)", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.category.findMany.mockResolvedValue([{ id: "cat-csv-1", name: "Casa" } as any]);
    prismaMock.subcategory.findMany.mockResolvedValue([
      { id: "sub-old", name: "Aluguel", categoryId: "cat-csv-1" } as any,
    ]);
    prismaMock.institution.findMany.mockResolvedValue([]);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
    prismaMock.transactionAlias.findMany.mockResolvedValue([mkAliasRecord()] as any);
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: {
          ...ALIAS_MAPPING,
          columns: { ...ALIAS_MAPPING.columns, category: "Cat", subcategory: "Sub" },
        },
        rows: [
          {
            Data: "03/01/2026",
            Valor: "100,00",
            Desc: "pagamento CEG",
            Cat: "Casa",
            Sub: "Aluguel",
          },
        ],
      } as any,
      EXEC_CTX,
    );

    const created = txMock.transaction.createMany.mock.calls[0][0].data[0];
    expect(created.categoryId).toBe("cat-alias-1"); // apelido venceu (DD-17)
    expect(created.subcategoryId).toBeNull(); // órfã da categoria antiga — limpa (DD-18)
  });

  it("grava metadata com appliedAliasId/aliasTrigger quando o apelido é aplicado", async () => {
    setupFoundResourcesWithAlias();
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: ALIAS_MAPPING,
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
      } as any,
      EXEC_CTX,
    );

    expect(txMock.transaction.createMany.mock.calls[0][0].data[0].metadata).toEqual({
      appliedAliasId: "alias-1",
      aliasTrigger: "CEG",
    });
  });

  it("persiste tags do apelido via transactionTag.createMany, vinculadas ao id gerado da transação", async () => {
    setupFoundResourcesWithAlias({ tags: [{ tag: { id: "tag-1", name: "Casa" } }] });
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: ALIAS_MAPPING,
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
      } as any,
      EXEC_CTX,
    );

    // id gerado pelo próprio service (generateTransactionId) — não é previsível
    // de antemão, então lemos o id enviado ao transaction.createMany e conferimos
    // que é exatamente o mesmo usado para vincular a tag (sem depender de índice).
    const createdId = txMock.transaction.createMany.mock.calls[0][0].data[0].id;
    expect(createdId).toMatch(/^c[^\s-]{8,}$/i); // formato aceito por z.string().cuid()
    expect(txMock.transactionTag.createMany).toHaveBeenCalledWith({
      data: [{ transactionId: createdId, tagId: "tag-1" }],
      skipDuplicates: true,
    });
  });

  it("não chama transactionTag.createMany quando o apelido não define tags", async () => {
    setupFoundResourcesWithAlias();
    const txMock = setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: ALIAS_MAPPING,
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
      } as any,
      EXEC_CTX,
    );

    expect(txMock.transactionTag.createMany).not.toHaveBeenCalled();
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

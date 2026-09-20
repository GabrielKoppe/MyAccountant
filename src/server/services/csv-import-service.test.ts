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

// Registro cru de apelido como o Prisma devolve (antes do serializer).
// Escopo de módulo porque os testes de apelido e os de `lastUsedAt` usam o mesmo.
function mkAliasRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "alias-1",
    trigger: "CEG",
    triggerNormalized: "ceg",
    triggerMode: "contains",
    priority: "medium",
    conditionInstitutionId: null,
    conditionInstitution: null,
    minCents: null,
    maxCents: null,
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

// ─── Spec 73 — parcelamentos de fatura ───────────────────────────────────────

describe("executeImport — ancoragem no mês de competência (spec 73 §2.1)", () => {
  // Fatura de competência JUNHO/2026 com a linha "EINSCRICAO 4/4", cuja data de
  // COMPRA é 06/03/2026. O cronograma deve ficar março→junho, não dez/2025→março.
  const JUNE_MONTH = {
    id: "month-jun",
    year: 2026,
    month: 6,
    accountId: "acc-test-1",
  };

  function setupJuneImport() {
    prismaMock.month.findFirst.mockResolvedValue(JUNE_MONTH as any);
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.category.findMany.mockResolvedValue([]);
    prismaMock.subcategory.findMany.mockResolvedValue([]);
    prismaMock.institution.findMany.mockResolvedValue([]);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
    prismaMock.transactionAlias.findMany.mockResolvedValue([]);

    const txMock = {
      financeTable: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "table-jun" }),
      },
      transaction: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      transactionTag: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      installmentGroup: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pendingInstallment: {
        createMany: vi.fn().mockResolvedValue({ count: 3 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (fn: any, _opts?: unknown) => fn(txMock));
    return txMock;
  }

  const EINSCRICAO_INPUT = {
    monthId: "month-jun",
    sectionId: "sec-1",
    tableTypeId: "tt-1",
    tableName: "Fatura Junho",
    countInMonth: true,
    mapping: MAPPING,
    rows: [{ Data: "06/03/2026", Valor: "229,83" }],
    acceptedInstallments: [
      {
        groupDescription: "einscricao",
        installmentCount: 4,
        lines: [{ rowIndex: 0, installmentNumber: 4 }],
        totalAmountCents: "22983",
      },
    ],
  };

  it("parcela 4/4 na fatura de junho: pendentes 1–3 em março, abril e maio de 2026", async () => {
    const txMock = setupJuneImport();

    await csvImportService.executeImport(EINSCRICAO_INPUT as any, EXEC_CTX);

    const pending = txMock.pendingInstallment.createMany.mock.calls[0][0].data as {
      installmentNumber: number;
      expectedDate: Date;
    }[];
    const byNumber = new Map(pending.map((p) => [p.installmentNumber, p.expectedDate]));

    expect([...byNumber.keys()].sort()).toEqual([1, 2, 3]);
    // Dia da compra (6) reaplicado em cada competência, em UTC
    expect(byNumber.get(1)!.toISOString()).toBe("2026-03-06T00:00:00.000Z");
    expect(byNumber.get(2)!.toISOString()).toBe("2026-04-06T00:00:00.000Z");
    expect(byNumber.get(3)!.toISOString()).toBe("2026-05-06T00:00:00.000Z");
  });

  it("startDate do grupo = competência da parcela 1 (não a data da compra retroagida)", async () => {
    const txMock = setupJuneImport();

    await csvImportService.executeImport(EINSCRICAO_INPUT as any, EXEC_CTX);

    const data = txMock.installmentGroup.createMany.mock.calls[0][0].data[0] as {
      startDate: Date;
      autoCreateOnNewMonth: boolean;
    };
    expect(data.startDate.toISOString()).toBe("2026-03-06T00:00:00.000Z");
    // Grupo vindo de import nasce sem criação automática (spec 73 §2.4)
    expect(data.autoCreateOnNewMonth).toBe(false);
  });

  it("dia da compra inexistente no mês destino é ajustado ao último dia válido", async () => {
    const txMock = setupJuneImport();

    await csvImportService.executeImport(
      {
        ...EINSCRICAO_INPUT,
        rows: [{ Data: "31/03/2026", Valor: "100,00" }],
        acceptedInstallments: [
          {
            groupDescription: "compra",
            installmentCount: 3,
            lines: [{ rowIndex: 0, installmentNumber: 3 }],
            totalAmountCents: "10000",
          },
        ],
      } as any,
      EXEC_CTX,
    );

    const pending = txMock.pendingInstallment.createMany.mock.calls[0][0].data as {
      installmentNumber: number;
      expectedDate: Date;
    }[];
    const byNumber = new Map(pending.map((p) => [p.installmentNumber, p.expectedDate]));
    // Parcela 3 = junho → parcela 1 = abril (30 dias), parcela 2 = maio
    expect(byNumber.get(1)!.toISOString()).toBe("2026-04-30T00:00:00.000Z");
    expect(byNumber.get(2)!.toISOString()).toBe("2026-05-31T00:00:00.000Z");
  });

  it("occurredOn da transação importada continua sendo a data da compra", async () => {
    const txMock = setupJuneImport();

    await csvImportService.executeImport(EINSCRICAO_INPUT as any, EXEC_CTX);

    const rows = txMock.transaction.createMany.mock.calls[0][0].data as {
      occurredOn: Date;
      installmentNumber: number | null;
    }[];
    expect(rows[0].occurredOn.toISOString()).toBe("2026-03-06T00:00:00.000Z");
    expect(rows[0].installmentNumber).toBe(4);
  });
});

describe("executeImport — vínculo com parcelamento existente (spec 73 §2.3)", () => {
  function setupJulyImport(existingGroup: unknown) {
    prismaMock.month.findFirst.mockResolvedValue({
      id: "month-jul",
      year: 2026,
      month: 7,
      accountId: "acc-test-1",
    } as any);
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1" } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);
    prismaMock.category.findMany.mockResolvedValue([]);
    prismaMock.subcategory.findMany.mockResolvedValue([]);
    prismaMock.institution.findMany.mockResolvedValue([]);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
    prismaMock.transactionAlias.findMany.mockResolvedValue([]);
    // O grupo a vincular é pré-carregado FORA da `$transaction` (um `findMany`
    // para todas as sugestões, em vez de um `findFirst` por sugestão).
    prismaMock.installmentGroup.findMany.mockResolvedValue(
      (existingGroup ? [existingGroup] : []) as any,
    );

    const txMock = {
      financeTable: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "table-jul" }),
      },
      transaction: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      transactionTag: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      installmentGroup: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      pendingInstallment: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (fn: any, _opts?: unknown) => fn(txMock));
    return txMock;
  }

  // "CYAN SHOES 3/3" na fatura de julho, continuando o grupo criado em junho
  const CYAN_INPUT = {
    monthId: "month-jul",
    sectionId: "sec-1",
    tableTypeId: "tt-1",
    tableName: "Fatura Julho",
    countInMonth: true,
    mapping: MAPPING,
    rows: [{ Data: "04/05/2026", Valor: "157,83" }],
    acceptedInstallments: [
      {
        groupDescription: "cyan shoes",
        installmentCount: 3,
        lines: [{ rowIndex: 0, installmentNumber: 3 }],
        totalAmountCents: "15783",
        existingGroupId: "grp-jun",
      },
    ],
  };

  it("vincula ao grupo existente, consome a pendente e não cria grupo novo", async () => {
    const txMock = setupJulyImport({
      id: "grp-jun",
      transactions: [{ installmentNumber: 2 }],
      pendingInstallments: [{ id: "pi-3", installmentNumber: 3 }],
    });

    const result = await csvImportService.executeImport(CYAN_INPUT as any, EXEC_CTX);

    expect(txMock.installmentGroup.createMany).not.toHaveBeenCalled();
    expect(txMock.pendingInstallment.createMany).not.toHaveBeenCalled();
    // Pendentes consumidas saem num único deleteMany, ainda escopado por account
    expect(txMock.pendingInstallment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["pi-3"] }, accountId: "acc-test-1" },
    });

    const rows = txMock.transaction.createMany.mock.calls[0][0].data as {
      installmentGroupId: string | null;
      installmentNumber: number | null;
    }[];
    expect(rows[0].installmentGroupId).toBe("grp-jun");
    expect(rows[0].installmentNumber).toBe(3);

    expect(result.installmentGroupsLinked).toBe(1);
    expect(result.installmentGroupsCreated).toBe(0);
    expect(result.installmentLinesSkipped).toBe(0);
  });

  it("multi-tenancy: busca o grupo escopada por accountId", async () => {
    setupJulyImport({
      id: "grp-jun",
      transactions: [],
      pendingInstallments: [{ id: "pi-3", installmentNumber: 3 }],
    });

    await csvImportService.executeImport(CYAN_INPUT as any, EXEC_CTX);

    expect(prismaMock.installmentGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["grp-jun"] }, accountId: "acc-test-1" },
      }),
    );
  });

  it("grupo de outra account: NotFoundError", async () => {
    setupJulyImport(null);

    await expect(
      csvImportService.executeImport(CYAN_INPUT as any, EXEC_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // Regressão: a fatura real que quebrou em produção (P2028 — "Transaction
  // already closed", 5116ms > timeout de 5000ms) tinha 17 parcelamentos, e o
  // código antigo fazia 1+ round-trip por sugestão DENTRO da `$transaction`.
  // Local o teste passaria de qualquer jeito (Postgres na mesma máquina); o que
  // o travamento precisa garantir é a CONTAGEM de idas ao banco, não o tempo.
  it("N parcelamentos não viram N round-trips dentro da transação", async () => {
    const LINES = 17;
    const txMock = setupJulyImport(null);
    prismaMock.installmentGroup.findMany.mockResolvedValue([]);

    await csvImportService.executeImport(
      {
        monthId: "month-jul",
        sectionId: "sec-1",
        tableTypeId: "tt-1",
        tableName: "Fatura com muitos parcelamentos",
        countInMonth: true,
        mapping: MAPPING,
        rows: Array.from({ length: LINES }, () => ({ Data: "04/05/2026", Valor: "100,00" })),
        acceptedInstallments: Array.from({ length: LINES }, (_, i) => ({
          groupDescription: `compra ${i}`,
          installmentCount: 10,
          lines: [{ rowIndex: i, installmentNumber: 2 }],
          totalAmountCents: "10000",
        })),
      } as any,
      EXEC_CTX,
    );

    // Um createMany para TODOS os grupos, um para TODAS as pendentes
    expect(txMock.installmentGroup.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.pendingInstallment.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.installmentGroup.createMany.mock.calls[0][0].data).toHaveLength(LINES);
    // 9 pendentes por grupo (a parcela 2 veio no CSV)
    expect(txMock.pendingInstallment.createMany.mock.calls[0][0].data).toHaveLength(LINES * 9);

    // Cada grupo tem id próprio, gerado pelo app (createMany não devolve ids)
    const groupIds = (
      txMock.installmentGroup.createMany.mock.calls[0][0].data as { id: string }[]
    ).map((g) => g.id);
    expect(new Set(groupIds).size).toBe(LINES);

    // Timeout explícito: 5s do default do Prisma não cobre uma fatura real
    const opts = prismaMock.$transaction.mock.calls[0][1] as { timeout: number };
    expect(opts.timeout).toBeGreaterThanOrEqual(20_000);
  });

  it("número já lançado no grupo: importa sem vínculo e reporta", async () => {
    const txMock = setupJulyImport({
      id: "grp-jun",
      // A parcela 3 já foi materializada (ex: auto-criação ao abrir o mês)
      transactions: [{ installmentNumber: 2 }, { installmentNumber: 3 }],
      pendingInstallments: [],
    });

    const result = await csvImportService.executeImport(CYAN_INPUT as any, EXEC_CTX);

    const rows = txMock.transaction.createMany.mock.calls[0][0].data as {
      installmentGroupId: string | null;
    }[];
    expect(rows[0].installmentGroupId).toBeNull();
    expect(result.installmentLinesSkipped).toBe(1);
    expect(txMock.pendingInstallment.deleteMany).not.toHaveBeenCalled();
  });
});

// ─── Spec 67 §2.4/§7.4 (SET-07) — recência dos objetos de configuração ───────

describe("executeImport — lastUsedAt dos objetos consumidos (spec 67 §7.4)", () => {
  const DIM_MAPPING = {
    columns: { date: "Data", amount: "Valor", category: "Cat", institution: "Inst" },
  };
  const DIM_ROWS = [{ Data: "03/01/2026", Valor: "100,00", Cat: "Casa", Inst: "Nubank" }];

  function setupDims() {
    setupFoundResources();
    prismaMock.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Casa" }] as any);
    prismaMock.institution.findMany.mockResolvedValue([{ id: "inst-1", name: "Nubank" }] as any);
  }

  /** `where` de todos os toques disparados, de todas as entidades. */
  function touchWheres() {
    return [
      ...prismaMock.section.updateMany.mock.calls,
      ...prismaMock.tableType.updateMany.mock.calls,
      ...prismaMock.category.updateMany.mock.calls,
      ...prismaMock.subcategory.updateMany.mock.calls,
      ...prismaMock.institution.updateMany.mock.calls,
      ...prismaMock.responsibleParty.updateMany.mock.calls,
      ...prismaMock.transactionAlias.updateMany.mock.calls,
      ...prismaMock.csvTemplate.updateMany.mock.calls,
    ].map(([args]) => (args as any).where);
  }

  it("marca seção, tipo de tabela e dimensões consumidas com o accountId do contexto", async () => {
    setupDims();
    setupTxMock();

    await csvImportService.executeImport(
      { ...EXEC_INPUT, mapping: DIM_MAPPING, rows: DIM_ROWS } as any,
      EXEC_CTX,
    );

    expect(prismaMock.section.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sec-1"] }, accountId: "acc-test-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(prismaMock.tableType.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["tt-1"] }, accountId: "acc-test-1" } }),
    );
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["cat-1"] }, accountId: "acc-test-1" } }),
    );
    expect(prismaMock.institution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["inst-1"] }, accountId: "acc-test-1" } }),
    );
  });

  it("multi-tenancy: nenhum toque de lastUsedAt roda sem o accountId da conta corrente", async () => {
    setupDims();
    setupTxMock();

    await csvImportService.executeImport(
      { ...EXEC_INPUT, mapping: DIM_MAPPING, rows: DIM_ROWS, templateId: "ctpl000000001" } as any,
      { accountId: "acc-OUTRA", userId: "user-outro" },
    );

    const wheres = touchWheres();
    expect(wheres.length).toBeGreaterThan(0);
    for (const where of wheres) {
      expect(where.accountId).toBe("acc-OUTRA");
    }
  });

  it("dimensão auto-criada durante o import também conta como usada", async () => {
    setupFoundResources(); // nenhuma categoria existente → onCategoryNotFound = "create"
    prismaMock.category.upsert.mockResolvedValue({ id: "cat-nova-1", name: "Mercado" } as any);
    setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: { columns: { date: "Data", amount: "Valor", category: "Cat" } },
        rows: [{ Data: "03/01/2026", Valor: "100,00", Cat: "Mercado" }],
      } as any,
      EXEC_CTX,
    );

    expect(prismaMock.category.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["cat-nova-1"] }, accountId: "acc-test-1" } }),
    );
  });

  it("marca o apelido efetivamente aplicado nas linhas importadas", async () => {
    setupFoundResources();
    prismaMock.transactionAlias.findMany.mockResolvedValue([mkAliasRecord()] as any);
    setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: { columns: { date: "Data", amount: "Valor", description: "Desc" } },
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
      } as any,
      EXEC_CTX,
    );

    expect(prismaMock.transactionAlias.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["alias-1"] }, accountId: "acc-test-1" } }),
    );
  });

  it("apelido com opt-out na linha (DD-16) não é marcado como usado", async () => {
    setupFoundResources();
    prismaMock.transactionAlias.findMany.mockResolvedValue([mkAliasRecord()] as any);
    setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: { columns: { date: "Data", amount: "Valor", description: "Desc" } },
        rows: [{ Data: "03/01/2026", Valor: "100,00", Desc: "pagamento CEG" }],
        aliasIgnoreRows: [0],
      } as any,
      EXEC_CTX,
    );

    expect(prismaMock.transactionAlias.updateMany).not.toHaveBeenCalled();
  });

  it("linha ignorada manualmente não marca as dimensões dela como usadas", async () => {
    setupFoundResources();
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-usada", name: "Casa" },
      { id: "cat-ignorada", name: "Lazer" },
    ] as any);
    setupTxMock();

    await csvImportService.executeImport(
      {
        ...EXEC_INPUT,
        mapping: { columns: { date: "Data", amount: "Valor", category: "Cat" } },
        rows: [
          { Data: "03/01/2026", Valor: "100,00", Cat: "Lazer" }, // rowIndex 0 — ignorada
          { Data: "04/01/2026", Valor: "200,00", Cat: "Casa" },
        ],
        manualIgnoreRows: [0],
      } as any,
      EXEC_CTX,
    );

    expect(prismaMock.category.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["cat-usada"] }, accountId: "acc-test-1" } }),
    );
  });

  it("marca o CsvTemplate escolhido no wizard e o salvo nesta importação", async () => {
    setupFoundResources();
    prismaMock.csvTemplate.upsert.mockResolvedValue({ id: "ctplsalvo00001" } as any);
    setupTxMock();

    await csvImportService.executeImport(
      { ...EXEC_INPUT, templateId: "ctplescolhido1", saveTemplateAs: "Fatura Nubank" } as any,
      EXEC_CTX,
    );

    expect(prismaMock.csvTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["ctplescolhido1", "ctplsalvo00001"] },
          accountId: "acc-test-1",
        },
      }),
    );
  });

  it("importação sem template continua idêntica: nenhum toque em CsvTemplate", async () => {
    setupFoundResources();
    setupTxMock();

    const result = await csvImportService.executeImport(EXEC_INPUT as any, EXEC_CTX);

    expect(result.imported).toBe(1);
    expect(prismaMock.csvTemplate.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.csvTemplate.upsert).not.toHaveBeenCalled();
  });

  it("falha ao gravar lastUsedAt não derruba a importação", async () => {
    setupDims();
    setupTxMock();
    prismaMock.section.updateMany.mockRejectedValue(new Error("db indisponível"));
    prismaMock.category.updateMany.mockRejectedValue(new Error("db indisponível"));

    const result = await csvImportService.executeImport(
      { ...EXEC_INPUT, mapping: DIM_MAPPING, rows: DIM_ROWS } as any,
      EXEC_CTX,
    );

    expect(result.tableId).toBe("table-imported-1");
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
    // deixa o fire-and-forget assentar para o catch interno do helper rodar
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

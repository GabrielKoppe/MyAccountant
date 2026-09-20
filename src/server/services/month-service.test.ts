import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";

import {
  createMonth,
  deleteMonth,
  getSectionTotals,
  previewMonthAutomations,
} from "./month-service";

// Tipo parcial do retorno de transaction.groupBy usado nos mocks deste describe
type GroupByRow = { sectionId: string; _sum: { amountCents: bigint | null } };

describe("getSectionTotals", () => {
  it("deve retornar {} imediatamente sem query quando sectionIds está vazio", async () => {
    // Act
    const result = await getSectionTotals("acc-test-1", "month-1", []);

    // Assert
    expect(result).toEqual({});
    expect(prismaMock.transaction.groupBy as unknown as Mock).not.toHaveBeenCalled();
  });

  it("deve usar uma única query groupBy para múltiplas seções", async () => {
    // Arrange
    const rows: GroupByRow[] = [
      { sectionId: "s1", _sum: { amountCents: 100000n } },
      { sectionId: "s2", _sum: { amountCents: 50000n } },
    ];
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue(rows as never);

    // Act
    const result = await getSectionTotals("acc-test-1", "month-1", ["s1", "s2", "s3"]);

    // Assert
    expect(prismaMock.transaction.groupBy as unknown as Mock).toHaveBeenCalledOnce();
    expect(result).toEqual({ s1: 100000n, s2: 50000n });
  });

  it("deve passar accountId, monthId e sectionIds corretos para o groupBy", async () => {
    // Arrange
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([] as never);

    // Act
    await getSectionTotals("acc-test-1", "month-1", ["s1", "s2"]);

    // Assert
    expect(prismaMock.transaction.groupBy as unknown as Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["sectionId"],
        where: expect.objectContaining({
          accountId: "acc-test-1",
          monthId: "month-1",
          sectionId: { in: ["s1", "s2"] },
          table: { countInMonth: true },
        }),
      }),
    );
  });

  it("deve retornar 0n para seção cujo _sum.amountCents é null", async () => {
    // Arrange
    const rows: GroupByRow[] = [{ sectionId: "s1", _sum: { amountCents: null } }];
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue(rows as never);

    // Act
    const result = await getSectionTotals("acc-test-1", "month-1", ["s1"]);

    // Assert
    expect(result).toEqual({ s1: 0n });
  });

  it("seções sem transações não aparecem no resultado (caller usa ?? 0n)", async () => {
    // Arrange
    const rows: GroupByRow[] = [{ sectionId: "s1", _sum: { amountCents: 200000n } }];
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue(rows as never);

    // Act
    const result = await getSectionTotals("acc-test-1", "month-1", ["s1", "s2"]);

    // Assert
    expect(result).toEqual({ s1: 200000n });
    expect(result["s2"]).toBeUndefined();
  });
});

describe("createMonth", () => {
  beforeEach(() => {
    // convertPendingInstallmentsForMonth sempre retorna vazio nos testes de mês
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
  });

  it("deve criar mês com sucesso sem templates automáticos", async () => {
    // Arrange
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([]);

    // Act
    const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    // Assert
    expect(result.monthId).toBe("month-novo-1");
    expect(result.autoApplied).toEqual([]);
    expect(prismaMock.month.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          year: 2026,
          month: 6,
          createdById: "user-test-1",
        }),
      }),
    );
  });

  it("deve lançar ConflictError se mês já existe na account", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-existente" } as any);

    await expect(createMonth({ year: 2026, month: 6 }, TEST_CTX)).rejects.toThrow(ConflictError);
  });

  it("deve auto-aplicar templates com autoApply=true ao criar mês", async () => {
    // Arrange
    const txMock = {
      financeTable: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "table-1" }),
      },
      transaction: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([
      {
        id: "tpl-1",
        name: "Gastos Fixos",
        autoApply: true,
        autoSectionId: "sec-1",
        autoTableTypeId: "tt-1",
        countInMonth: true,
        items: [],
      },
    ] as any);
    prismaMock.section.findFirst.mockResolvedValue({
      id: "sec-1",
      accountId: "acc-test-1",
      isActive: true,
    } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({
      id: "tt-1",
      accountId: "acc-test-1",
    } as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    // Act
    const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    // Assert
    expect(result.autoApplied).toHaveLength(1);
    expect(result.autoApplied[0]).toMatchObject({ templateName: "Gastos Fixos", success: true });
    expect(txMock.financeTable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          monthId: "month-novo-1",
          sectionId: "sec-1",
          name: "Gastos Fixos",
          sourceMethod: "template",
        }),
      }),
    );
  });

  it("deve criar tabela vazia quando template não tem itens (melhor esforço)", async () => {
    // Arrange
    const txMock = {
      financeTable: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "table-2" }),
      },
      transaction: { createMany: vi.fn() },
    };
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([
      {
        id: "tpl-vazio",
        name: "Template Vazio",
        autoApply: true,
        autoSectionId: "sec-1",
        autoTableTypeId: "tt-1",
        countInMonth: true,
        items: [],
      },
    ] as any);
    prismaMock.section.findFirst.mockResolvedValue({
      id: "sec-1",
      accountId: "acc-test-1",
      isActive: true,
    } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({
      id: "tt-1",
      accountId: "acc-test-1",
    } as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    // Act
    const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    // Assert
    expect(result.autoApplied[0]).toMatchObject({ templateName: "Template Vazio", success: true });
    expect(txMock.financeTable.create).toHaveBeenCalledOnce();
    expect(txMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it("deve registrar falha no autoApply quando seção não existe (melhor esforço)", async () => {
    // Arrange
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([
      {
        id: "tpl-1",
        name: "Modelo Inválido",
        autoApply: true,
        autoSectionId: "sec-inexistente",
        autoTableTypeId: "tt-1",
        countInMonth: true,
        items: [],
      },
    ] as any);
    prismaMock.section.findFirst.mockResolvedValue(null);
    prismaMock.tableType.findFirst.mockResolvedValue({ id: "tt-1" } as any);

    // Act
    const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    // Assert — mês criado com sucesso mesmo com template inválido
    expect(result.monthId).toBe("month-novo-1");
    expect(result.autoApplied).toHaveLength(1);
    expect(result.autoApplied[0]).toMatchObject({
      templateName: "Modelo Inválido",
      success: false,
    });
    expect(result.autoApplied[0].error).toBeDefined();
    expect(typeof result.autoApplied[0].error).toBe("string");
  });

  it("não deve vazar dados de outra account no autoApply (multi-tenancy)", async () => {
    // Arrange
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([]);

    // Act
    await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    // Assert — query de templates filtrada pela account correta
    expect(prismaMock.tableTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-test-1", autoApply: true }),
      }),
    );
  });
});

describe("deleteMonth", () => {
  it("deve deletar mês quando usuário é owner", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.month.delete.mockResolvedValue({} as any);

    await deleteMonth({ monthId: "month-1" }, TEST_CTX);

    expect(prismaMock.month.delete).toHaveBeenCalledWith({ where: { id: "month-1" } });
  });

  it("deve lançar ForbiddenError quando usuário não é owner", async () => {
    const editorCtx = { ...TEST_CTX, role: "editor" as const };

    await expect(deleteMonth({ monthId: "month-1" }, editorCtx)).rejects.toThrow(ForbiddenError);
  });

  it("não deve deletar mês de outra account (segurança multi-tenancy)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteMonth({ monthId: "month-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);
  });

  it("deve lançar NotFoundError se mês não existe", async () => {
    prismaMock.month.findUnique.mockResolvedValue(null);

    await expect(deleteMonth({ monthId: "month-inexistente" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

// ─── Spec 73 §2.4 — automações do mês ────────────────────────────────────────

describe("createMonth — seleção de automações (spec 73 §2.4)", () => {
  beforeEach(() => {
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([]);
  });

  it("sem `selection`: mantém o comportamento automático (todos os autoApply + flag do grupo)", async () => {
    await createMonth({ year: 2026, month: 8 }, TEST_CTX);

    const tplWhere = prismaMock.tableTemplate.findMany.mock.calls[0][0]!.where as {
      autoApply: boolean;
      id?: unknown;
    };
    expect(tplWhere.autoApply).toBe(true);
    expect(tplWhere.id).toBeUndefined();

    const piWhere = prismaMock.pendingInstallment.findMany.mock.calls[0][0]!.where as {
      group?: { autoCreateOnNewMonth: boolean };
    };
    expect(piWhere.group).toEqual({ autoCreateOnNewMonth: true });
  });

  it("com `selection`: aplica só os ids escolhidos e ignora a flag do grupo", async () => {
    await createMonth(
      {
        year: 2026,
        month: 8,
        selection: { templateIds: ["tpl-1"], pendingInstallmentIds: ["pi-9"] },
      },
      TEST_CTX,
    );

    const tplWhere = prismaMock.tableTemplate.findMany.mock.calls[0][0]!.where as {
      id: { in: string[] };
    };
    expect(tplWhere.id).toEqual({ in: ["tpl-1"] });

    const piWhere = prismaMock.pendingInstallment.findMany.mock.calls[0][0]!.where as {
      id: { in: string[] };
      group?: unknown;
    };
    expect(piWhere.id).toEqual({ in: ["pi-9"] });
    expect(piWhere.group).toBeUndefined();
  });

  it("seleção vazia: não consulta modelos e não converte parcela nenhuma", async () => {
    const result = await createMonth(
      { year: 2026, month: 8, selection: { templateIds: [], pendingInstallmentIds: [] } },
      TEST_CTX,
    );

    expect(prismaMock.tableTemplate.findMany).not.toHaveBeenCalled();
    expect(result.autoApplied).toEqual([]);
    expect(result.installmentsConverted.converted).toBe(0);
  });
});

describe("previewMonthAutomations (spec 73 §2.4)", () => {
  beforeEach(() => {
    prismaMock.tableTemplate.findMany.mockResolvedValue([]);
    prismaMock.section.findMany.mockResolvedValue([]);
    prismaMock.tableType.findMany.mockResolvedValue([]);
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
  });

  it("não escreve nada e filtra por accountId, mês em UTC e parcelas não pagas", async () => {
    await previewMonthAutomations({ year: 2026, month: 8 }, TEST_CTX);

    expect(prismaMock.month.create).not.toHaveBeenCalled();
    expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
    expect(prismaMock.pendingInstallment.delete).not.toHaveBeenCalled();

    const where = prismaMock.pendingInstallment.findMany.mock.calls[0][0]!.where as {
      accountId: string;
      settledAt: null;
      expectedDate: { gte: Date; lte: Date };
    };
    expect(where.accountId).toBe("acc-test-1");
    expect(where.settledAt).toBeNull();
    expect(where.expectedDate.gte.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(where.expectedDate.lte.toISOString()).toBe("2026-08-31T23:59:59.999Z");
  });

  it("sem modelos nem parcelas: retorna lista vazia (host pula o passo)", async () => {
    const groups = await previewMonthAutomations({ year: 2026, month: 8 }, TEST_CTX);
    expect(groups).toEqual([]);
  });

  it("modelo bem configurado vem marcado; modelo sem seção vem bloqueado com motivo", async () => {
    prismaMock.section.findMany.mockResolvedValue([
      { id: "sec-1", name: "Gastos", isActive: true },
    ] as any);
    prismaMock.tableType.findMany.mockResolvedValue([{ id: "tt-1", name: "Cartão" }] as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([
      {
        id: "tpl-ok",
        name: "Contas fixas",
        autoSectionId: "sec-1",
        autoTableTypeId: "tt-1",
        items: [{ amountCents: 1000n }, { amountCents: 2000n }],
      },
      {
        id: "tpl-sem-secao",
        name: "Investimentos",
        autoSectionId: null,
        autoTableTypeId: "tt-1",
        items: [],
      },
    ] as any);

    const groups = await previewMonthAutomations({ year: 2026, month: 8 }, TEST_CTX);
    const templates = groups.find((g) => g.kind === "table_template")!;

    expect(templates.items[0]).toMatchObject({
      id: "tpl-ok",
      label: "Contas fixas",
      sectionName: "Gastos",
      tableTypeName: "Cartão",
      itemCount: 2,
      amountCents: "3000",
      defaultSelected: true,
      blockedReason: null,
    });
    expect(templates.items[1]).toMatchObject({
      id: "tpl-sem-secao",
      defaultSelected: false,
      blockedReason: "missing_section",
    });
  });

  it("parcela de grupo manual vem marcada; parcela de grupo de import vem desmarcada", async () => {
    prismaMock.section.findMany.mockResolvedValue([
      { id: "sec-1", name: "Gastos", isActive: true },
    ] as any);
    prismaMock.tableType.findMany.mockResolvedValue([{ id: "tt-1", name: "Cartão" }] as any);
    prismaMock.pendingInstallment.findMany.mockResolvedValue([
      {
        id: "pi-manual",
        installmentNumber: 6,
        amountCents: 9800n,
        description: "Anuidade Diferenciada",
        group: {
          description: "Anuidade Diferenciada",
          installmentCount: 12,
          autoCreateOnNewMonth: true,
          sectionId: "sec-1",
          tableTypeId: "tt-1",
        },
      },
      {
        id: "pi-import",
        installmentNumber: 3,
        amountCents: 15783n,
        description: null,
        group: {
          description: "cyan shoes",
          installmentCount: 3,
          autoCreateOnNewMonth: false,
          sectionId: "sec-1",
          tableTypeId: null,
        },
      },
    ] as any);

    const groups = await previewMonthAutomations({ year: 2026, month: 8 }, TEST_CTX);
    const installments = groups.find((g) => g.kind === "pending_installment")!;

    expect(installments.items[0]).toMatchObject({
      id: "pi-manual",
      label: "Anuidade Diferenciada",
      installmentNumber: 6,
      installmentCount: 12,
      amountCents: "9800",
      defaultSelected: true,
      blockedReason: null,
    });
    expect(installments.items[1]).toMatchObject({
      id: "pi-import",
      // cai na descrição do grupo quando a pendência não tem própria
      label: "cyan shoes",
      tableTypeName: null,
      defaultSelected: false,
    });
  });

  it("parcela cuja seção destino está inativa vem bloqueada", async () => {
    prismaMock.section.findMany.mockResolvedValue([
      { id: "sec-off", name: "Arquivada", isActive: false },
    ] as any);
    prismaMock.tableType.findMany.mockResolvedValue([] as any);
    prismaMock.pendingInstallment.findMany.mockResolvedValue([
      {
        id: "pi-1",
        installmentNumber: 2,
        amountCents: 100n,
        description: "X",
        group: {
          description: "X",
          installmentCount: 3,
          autoCreateOnNewMonth: true,
          sectionId: "sec-off",
          tableTypeId: null,
        },
      },
    ] as any);

    const groups = await previewMonthAutomations({ year: 2026, month: 8 }, TEST_CTX);
    expect(groups[0].items[0].blockedReason).toBe("section_not_found");
  });
});

// ─── Spec 67 §2.4/§7.4 (SET-07) — recência dos objetos de configuração ───────

describe("createMonth — lastUsedAt dos objetos consumidos (spec 67 §7.4)", () => {
  const TEMPLATE_ITEM = {
    id: "item-1",
    day: 5,
    amountCents: 10000n,
    description: "Aluguel",
    notes: null,
    isPending: false,
    displayOrder: 0,
    categoryId: "cat-1",
    subcategoryId: "sub-1",
    institutionId: "inst-1",
    responsiblePartyId: "rp-1",
    cardInstallment: null,
    investmentType: null,
    expenseType: null,
  };

  /** Cenário base: um modelo autoApply bem configurado, aplicado com sucesso. */
  function setupAppliedTemplate(items: unknown[] = [TEMPLATE_ITEM]) {
    const txMock = {
      financeTable: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "table-1" }),
      },
      transaction: { createMany: vi.fn().mockResolvedValue({ count: items.length }) },
    };
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([
      {
        id: "tpl-1",
        name: "Gastos Fixos",
        autoApply: true,
        autoSectionId: "sec-1",
        autoTableTypeId: "tt-1",
        countInMonth: true,
        items,
      },
    ] as any);
    prismaMock.section.findFirst.mockResolvedValue({
      id: "sec-1",
      accountId: "acc-test-1",
      isActive: true,
    } as any);
    prismaMock.tableType.findFirst.mockResolvedValue({
      id: "tt-1",
      accountId: "acc-test-1",
    } as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));
    return txMock;
  }

  it("marca modelo, seção e tipo de tabela aplicados com o accountId do contexto", async () => {
    setupAppliedTemplate();

    await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    expect(prismaMock.tableTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["tpl-1"] }, accountId: "acc-test-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(prismaMock.section.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["sec-1"] }, accountId: "acc-test-1" } }),
    );
    expect(prismaMock.tableType.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["tt-1"] }, accountId: "acc-test-1" } }),
    );
  });

  it("marca as dimensões vindas dos itens do modelo", async () => {
    setupAppliedTemplate();

    await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    expect(prismaMock.category.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["cat-1"] }, accountId: "acc-test-1" } }),
    );
    expect(prismaMock.subcategory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["sub-1"] }, accountId: "acc-test-1" } }),
    );
    expect(prismaMock.institution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["inst-1"] }, accountId: "acc-test-1" } }),
    );
    expect(prismaMock.responsibleParty.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["rp-1"] }, accountId: "acc-test-1" } }),
    );
  });

  it("multi-tenancy: nenhum toque roda sem o accountId da conta corrente", async () => {
    setupAppliedTemplate();

    await createMonth({ year: 2026, month: 6 }, { ...TEST_CTX, accountId: "acc-OUTRA" });

    const wheres = [
      ...prismaMock.tableTemplate.updateMany.mock.calls,
      ...prismaMock.section.updateMany.mock.calls,
      ...prismaMock.tableType.updateMany.mock.calls,
      ...prismaMock.category.updateMany.mock.calls,
      ...prismaMock.subcategory.updateMany.mock.calls,
      ...prismaMock.institution.updateMany.mock.calls,
      ...prismaMock.responsibleParty.updateMany.mock.calls,
    ].map(([args]) => (args as unknown as { where: { accountId: string } }).where);

    expect(wheres.length).toBeGreaterThan(0);
    for (const where of wheres) {
      expect(where.accountId).toBe("acc-OUTRA");
    }
  });

  it("modelo que falhou não marca nada como usado", async () => {
    setupAppliedTemplate();
    prismaMock.section.findFirst.mockResolvedValue(null); // seção configurada sumiu

    const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    expect(result.autoApplied[0]).toMatchObject({ success: false });
    expect(prismaMock.tableTemplate.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.section.updateMany).not.toHaveBeenCalled();
  });

  it("mês sem modelos automáticos não dispara toque nenhum", async () => {
    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([]);

    await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    expect(prismaMock.tableTemplate.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.section.updateMany).not.toHaveBeenCalled();
  });

  it("falha ao gravar lastUsedAt não derruba a criação do mês", async () => {
    setupAppliedTemplate();
    prismaMock.tableTemplate.updateMany.mockRejectedValue(new Error("db indisponível"));
    prismaMock.section.updateMany.mockRejectedValue(new Error("db indisponível"));

    const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    expect(result.monthId).toBe("month-novo-1");
    expect(result.autoApplied[0]).toMatchObject({ templateName: "Gastos Fixos", success: true });
    // deixa o fire-and-forget assentar para o catch interno do helper rodar
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

// ─── Spec 69 §4 (pacote P8) — dia relativo, valor em branco, ordem e seção inativa ──

describe("createMonth — modelos da Spec 69 (P8)", () => {
  /** Item de modelo mínimo; cada teste sobrescreve só o que está exercitando. */
  function templateItem(over: Record<string, unknown> = {}) {
    return {
      id: "item-1",
      day: 5,
      dayRule: "5",
      amountCents: 10000n,
      description: "Aluguel",
      notes: null,
      isPending: false,
      displayOrder: 0,
      categoryId: null,
      subcategoryId: null,
      institutionId: null,
      responsiblePartyId: null,
      cardInstallment: null,
      investmentType: null,
      expenseType: null,
      ...over,
    };
  }

  /** Modelo com automação ligada e bem configurado; `over` ajusta o cenário. */
  function template(over: Record<string, unknown> = {}) {
    return {
      id: "tpl-1",
      name: "Contas fixas",
      autoApply: true,
      autoSectionId: "sec-1",
      tableTypeId: "tt-1",
      autoTableTypeId: null,
      orderInSection: null,
      countInMonth: true,
      items: [],
      ...over,
    };
  }

  /**
   * Registra o que foi criado em vez de só contar chamadas: as asserções deste
   * pacote são sobre o CONTEÚDO (data resolvida, ordem, proveniência).
   * `sections` mapeia id → `isActive`; id ausente = seção que não existe.
   */
  function setup(templates: unknown[], sections: Record<string, boolean> = { "sec-1": true }) {
    const tables: Array<Record<string, any>> = [];
    const rows: Array<Record<string, any>> = [];

    const txMock = {
      financeTable: {
        // Conta por seção, como o Prisma faria — é ela que vira `displayOrder`.
        count: vi.fn(
          async ({ where }: any) => tables.filter((t) => t.sectionId === where.sectionId).length,
        ),
        create: vi.fn(async ({ data }: any) => {
          tables.push(data);
          return { id: `table-${tables.length}` };
        }),
      },
      transaction: {
        createMany: vi.fn(async ({ data }: any) => {
          rows.push(...data);
          return { count: data.length };
        }),
      },
    };

    prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue(templates as any);
    prismaMock.section.findFirst.mockImplementation((async ({ where }: any) =>
      where.id in sections ? { id: where.id, isActive: sections[where.id] } : null) as never);
    prismaMock.tableType.findFirst.mockResolvedValue({
      id: "tt-1",
      accountId: "acc-test-1",
    } as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));

    return { tables, rows, txMock };
  }

  /** `occurredOn` é construído em horário local (`@db.Date`), como `applyDayToMonth`. */
  function localDate(date: Date) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  }

  describe("dia relativo (dayRule) resolvido para a data real do mês", () => {
    it('"último dia" cai em 28 num fevereiro não bissexto', async () => {
      const { rows } = setup([template({ items: [templateItem({ dayRule: "last", day: 31 })] })]);

      await createMonth({ year: 2027, month: 2 }, TEST_CTX);

      expect(localDate(rows[0].occurredOn)).toEqual([2027, 2, 28]);
    });

    it("dia fixo maior que o mês cai no último dia (dia 30 em fevereiro)", async () => {
      const { rows } = setup([template({ items: [templateItem({ dayRule: "30", day: 30 })] })]);

      await createMonth({ year: 2027, month: 2 }, TEST_CTX);

      expect(localDate(rows[0].occurredOn)).toEqual([2027, 2, 28]);
    });

    it("dia 31 num mês de 31 dias é respeitado como está", async () => {
      const { rows } = setup([template({ items: [templateItem({ dayRule: "31", day: 31 })] })]);

      await createMonth({ year: 2026, month: 7 }, TEST_CTX);

      expect(localDate(rows[0].occurredOn)).toEqual([2026, 7, 31]);
    });

    it('"primeiro dia útil" pula o fim de semana quando o dia 1 é sábado', async () => {
      // 01/08/2026 é sábado → primeiro dia útil é segunda, 03/08.
      const { rows } = setup([
        template({ items: [templateItem({ dayRule: "firstBusiness", day: 1 })] }),
      ]);

      await createMonth({ year: 2026, month: 8 }, TEST_CTX);

      expect(localDate(rows[0].occurredOn)).toEqual([2026, 8, 3]);
    });

    it("item legado sem dayRule cai no `day` (fallback), sem quebrar", async () => {
      const { rows } = setup([template({ items: [templateItem({ dayRule: null, day: 12 })] })]);

      await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(localDate(rows[0].occurredOn)).toEqual([2026, 6, 12]);
    });
  });

  describe("valor 0,00 = transação em branco", () => {
    it("nasce com 0 e PENDENTE, mantendo o que identifica a linha", async () => {
      const { rows } = setup([
        template({
          items: [
            templateItem({
              amountCents: 0n,
              isPending: false,
              description: "Conta de luz",
              categoryId: "cat-1",
            }),
          ],
        }),
      ]);

      await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(rows[0]).toMatchObject({
        amountCents: 0n,
        isPending: true,
        description: "Conta de luz",
        categoryId: "cat-1",
      });
    });

    it("item com valor não-zero preserva o isPending configurado no modelo", async () => {
      const { rows } = setup([
        template({
          items: [
            templateItem({ id: "a", amountCents: 5000n, isPending: false }),
            templateItem({ id: "b", amountCents: -5000n, isPending: true }),
          ],
        }),
      ]);

      await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(rows.map((r) => [r.amountCents, r.isPending])).toEqual([
        [5000n, false],
        [-5000n, true],
      ]);
    });
  });

  describe("orderInSection", () => {
    it("aplica na ordem configurada, e o modelo sem ordem vai para o fim", async () => {
      const { tables } = setup([
        // Ordem do banco (createdAt asc) propositalmente embaralhada.
        template({ id: "t-sem-ordem", name: "Sem ordem", orderInSection: null }),
        template({ id: "t-segundo", name: "Segundo", orderInSection: 1 }),
        template({ id: "t-primeiro", name: "Primeiro", orderInSection: 0 }),
      ]);

      const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(tables.map((t) => [t.name, t.displayOrder])).toEqual([
        ["Primeiro", 0],
        ["Segundo", 1],
        ["Sem ordem", 2],
      ]);
      expect(result.autoApplied.map((r) => r.templateName)).toEqual([
        "Primeiro",
        "Segundo",
        "Sem ordem",
      ]);
    });

    it("sem nenhuma ordem definida, mantém o critério de hoje (createdAt asc do banco)", async () => {
      const { tables } = setup([
        template({ id: "t-a", name: "A" }),
        template({ id: "t-b", name: "B" }),
      ]);

      await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(tables.map((t) => [t.name, t.displayOrder])).toEqual([
        ["A", 0],
        ["B", 1],
      ]);
    });

    it("displayOrder é contado por seção — seções diferentes não se somam", async () => {
      const { tables } = setup(
        [
          template({ id: "t-a", name: "A", autoSectionId: "sec-1", orderInSection: 0 }),
          template({ id: "t-b", name: "B", autoSectionId: "sec-2", orderInSection: 0 }),
        ],
        { "sec-1": true, "sec-2": true },
      );

      await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(tables.map((t) => [t.sectionId, t.displayOrder])).toEqual([
        ["sec-1", 0],
        ["sec-2", 0],
      ]);
    });
  });

  describe("seção de destino inativa (Spec 68)", () => {
    it("não cria tabela, e os outros modelos seguem sendo aplicados", async () => {
      const { tables } = setup(
        [
          template({ id: "t-off", name: "Modelo travado", autoSectionId: "sec-off" }),
          template({ id: "t-ok", name: "Modelo bom", autoSectionId: "sec-1" }),
        ],
        { "sec-1": true, "sec-off": false },
      );

      const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(tables.map((t) => t.name)).toEqual(["Modelo bom"]);
      expect(result.autoApplied).toEqual([
        {
          templateName: "Modelo travado",
          success: false,
          error: expect.stringMatching(/inativa/i),
        },
        { templateName: "Modelo bom", success: true },
      ]);
    });

    it("o mês é criado mesmo que TODOS os modelos estejam travados", async () => {
      setup([template({ autoSectionId: "sec-off" })], { "sec-off": false });

      const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(result.monthId).toBe("month-novo-1");
      expect(result.autoApplied[0]).toMatchObject({ success: false });
    });

    it("preview marca o modelo como bloqueado em vez de deixar falhar depois", async () => {
      prismaMock.tableTemplate.findMany.mockResolvedValue([
        { id: "tpl-1", name: "Travado", autoSectionId: "sec-off", tableTypeId: "tt-1", items: [] },
      ] as any);
      prismaMock.section.findMany.mockResolvedValue([
        { id: "sec-off", name: "Arquivada", isActive: false },
      ] as any);
      prismaMock.tableType.findMany.mockResolvedValue([{ id: "tt-1", name: "Manual" }] as any);
      prismaMock.pendingInstallment.findMany.mockResolvedValue([]);

      const groups = await previewMonthAutomations({ year: 2026, month: 6 }, TEST_CTX);

      expect(groups[0].items[0]).toMatchObject({
        blockedReason: "section_not_found",
        defaultSelected: false,
      });
    });
  });

  describe("proveniência e consolidação do tipo de tabela (D6, D7)", () => {
    it("grava createdFromTemplateId na tabela criada", async () => {
      const { tables } = setup([template({ id: "tpl-provenance" })]);

      await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(tables[0]).toMatchObject({
        createdFromTemplateId: "tpl-provenance",
        sourceMethod: "template",
      });
    });

    it("usa tableTypeId (campo consolidado) na tabela criada", async () => {
      const { tables } = setup([template({ tableTypeId: "tt-1", autoTableTypeId: null })]);

      await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(tables[0].tableTypeId).toBe("tt-1");
      expect(prismaMock.tableType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "tt-1" }) }),
      );
    });

    it("modelo legado que só tem autoTableTypeId continua criando (fallback de leitura)", async () => {
      const { tables } = setup([template({ tableTypeId: null, autoTableTypeId: "tt-1" })]);

      const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(result.autoApplied[0]).toMatchObject({ success: true });
      expect(tables[0].tableTypeId).toBe("tt-1");
    });

    it("modelo sem NENHUM dos dois campos falha com motivo, sem derrubar o mês", async () => {
      setup([template({ tableTypeId: null, autoTableTypeId: null })]);

      const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

      expect(result.monthId).toBe("month-novo-1");
      expect(result.autoApplied[0]).toMatchObject({ success: false });
    });
  });

  it("multi-tenancy: toda leitura e toda escrita usam o accountId do contexto", async () => {
    const { tables, rows } = setup([template({ items: [templateItem()] })]);

    await createMonth({ year: 2026, month: 6 }, { ...TEST_CTX, accountId: "acc-OUTRA" });

    expect(prismaMock.tableTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-OUTRA" }) }),
    );
    expect(prismaMock.section.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-OUTRA" }) }),
    );
    expect(prismaMock.tableType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-OUTRA" }) }),
    );
    expect(tables[0].accountId).toBe("acc-OUTRA");
    expect(rows[0].accountId).toBe("acc-OUTRA");
  });
});

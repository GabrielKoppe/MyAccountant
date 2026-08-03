import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";

import {
  calculateMonthTotal,
  createMonth,
  deleteMonth,
  getSectionTotals,
  previewMonthAutomations,
} from "./month-service";

describe("calculateMonthTotal (função pura)", () => {
  it("deve somar seções com countType=add", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "add" as const },
    ];
    const totals = { s1: 10000n, s2: 5000n };
    expect(calculateMonthTotal(sections, totals)).toBe(15000n);
  });

  it("deve subtrair seções com countType=subtract", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "subtract" as const },
    ];
    const totals = { s1: 10000n, s2: 3000n };
    expect(calculateMonthTotal(sections, totals)).toBe(7000n);
  });

  it("deve somar (não subtrair) seções com countType=neutral", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "neutral" as const },
    ];
    const totals = { s1: 10000n, s2: 5000n };
    expect(calculateMonthTotal(sections, totals)).toBe(15000n);
  });

  it("deve ignorar seções com countType=ignore", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "ignore" as const },
    ];
    const totals = { s1: 10000n, s2: 99999n };
    expect(calculateMonthTotal(sections, totals)).toBe(10000n);
  });

  it("deve tratar seção sem total como 0", () => {
    const sections = [{ id: "s1", countType: "add" as const }];
    expect(calculateMonthTotal(sections, {})).toBe(0n);
  });

  it("deve retornar 0 para lista vazia de seções", () => {
    expect(calculateMonthTotal([], {})).toBe(0n);
  });

  it("deve calcular corretamente com combinação de todos os tipos", () => {
    const sections = [
      { id: "renda", countType: "add" as const },
      { id: "gastos", countType: "subtract" as const },
      { id: "investimentos", countType: "neutral" as const },
      { id: "informativo", countType: "ignore" as const },
    ];
    const totals = {
      renda: 500000n, // R$ 5.000
      gastos: 200000n, // R$ 2.000
      investimentos: 100000n, // R$ 1.000
      informativo: 999999n, // ignorado
    };
    // 5.000 - 2.000 + 1.000 = 4.000
    expect(calculateMonthTotal(sections, totals)).toBe(400000n);
  });

  it("deve lidar com totais negativos em seções subtract", () => {
    // Um gasto negativo (crédito/estorno) em seção subtract
    const sections = [{ id: "gastos", countType: "subtract" as const }];
    const totals = { gastos: -5000n }; // crédito de R$ 50
    // subtract(-50) = +50
    expect(calculateMonthTotal(sections, totals)).toBe(5000n);
  });
});

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
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1", accountId: "acc-test-1" } as any);
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
    prismaMock.section.findFirst.mockResolvedValue({ id: "sec-1", accountId: "acc-test-1" } as any);
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

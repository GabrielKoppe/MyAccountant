import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";

import { calculateMonthTotal, createMonth, deleteMonth, getSectionTotals } from "./month-service";

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

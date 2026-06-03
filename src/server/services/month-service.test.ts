import { describe, expect, it } from "vitest";

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
      renda: 500000n,    // R$ 5.000
      gastos: 200000n,   // R$ 2.000
      investimentos: 100000n, // R$ 1.000
      informativo: 999999n,   // ignorado
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
    expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
  });

  it("deve usar uma única query groupBy para múltiplas seções", async () => {
    // Arrange
    const rows: GroupByRow[] = [
      { sectionId: "s1", _sum: { amountCents: 100000n } },
      { sectionId: "s2", _sum: { amountCents: 50000n } },
    ];
    prismaMock.transaction.groupBy.mockResolvedValue(rows as never);

    // Act
    const result = await getSectionTotals("acc-test-1", "month-1", ["s1", "s2", "s3"]);

    // Assert
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledOnce();
    expect(result).toEqual({ s1: 100000n, s2: 50000n });
  });

  it("deve passar accountId, monthId e sectionIds corretos para o groupBy", async () => {
    // Arrange
    prismaMock.transaction.groupBy.mockResolvedValue([] as never);

    // Act
    await getSectionTotals("acc-test-1", "month-1", ["s1", "s2"]);

    // Assert
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledWith(
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
    prismaMock.transaction.groupBy.mockResolvedValue(rows as never);

    // Act
    const result = await getSectionTotals("acc-test-1", "month-1", ["s1"]);

    // Assert
    expect(result).toEqual({ s1: 0n });
  });

  it("seções sem transações não aparecem no resultado (caller usa ?? 0n)", async () => {
    // Arrange
    const rows: GroupByRow[] = [{ sectionId: "s1", _sum: { amountCents: 200000n } }];
    prismaMock.transaction.groupBy.mockResolvedValue(rows as never);

    // Act
    const result = await getSectionTotals("acc-test-1", "month-1", ["s1", "s2"]);

    // Assert
    expect(result).toEqual({ s1: 200000n });
    expect(result["s2"]).toBeUndefined();
  });
});

describe("createMonth", () => {
  it("deve criar mês com sucesso", async () => {
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.month.create.mockResolvedValue({ id: "month-novo-1" } as any);

    const result = await createMonth({ year: 2026, month: 6 }, TEST_CTX);

    expect(result.monthId).toBe("month-novo-1");
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

import { describe, expect, it, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import {
  getMonthDeepDive as _getMonthDeepDive,
  getInstitutionBreakdown,
  getWeeklySpending,
  getTransactionCount,
} from "./dashboards";

const SECTIONS_STUB = [
  { id: "sec-1", name: "Entradas", countType: "add" as const, order: 0 },
  { id: "sec-2", name: "Saídas", countType: "subtract" as const, order: 1 },
];

function setupEmptyMonth() {
  prismaMock.section.findMany.mockResolvedValue(SECTIONS_STUB as any);
  prismaMock.transaction.findMany.mockResolvedValue([]);
  (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([]);
  prismaMock.category.findMany.mockResolvedValue([]);
}

describe("getMonthDeepDive", () => {
  it("mês sem transações retorna totais de seção zerados como strings", async () => {
    setupEmptyMonth();

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(result.sectionTotals["sec-1"]).toBe("0");
    expect(result.sectionTotals["sec-2"]).toBe("0");
  });

  it("mês sem transações retorna monthTotal como string '0'", async () => {
    setupEmptyMonth();

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(typeof result.monthTotal).toBe("string");
    expect(result.monthTotal).toBe("0");
  });

  it("mês sem transações retorna arrays vazios", async () => {
    setupEmptyMonth();

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(result.topTransactions).toHaveLength(0);
    expect(result.favoriteTransactions).toHaveLength(0);
    expect(result.topCategories).toHaveLength(0);
  });

  it("serializa amountCents de transações como string (sem BigInt na fronteira RSC→Client)", async () => {
    prismaMock.section.findMany.mockResolvedValue(SECTIONS_STUB as any);
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        description: "Mercado",
        occurredOn: new Date("2026-01-03"),
        amountCents: 15000n,
        section: { name: "Saídas", countType: "subtract" },
      },
    ] as any);
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([]);
    prismaMock.category.findMany.mockResolvedValue([]);

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(typeof result.topTransactions[0].amountCents).toBe("string");
    expect(result.topTransactions[0].amountCents).toBe("15000");
  });

  it("serializa totalCents de categorias como string", async () => {
    prismaMock.section.findMany.mockResolvedValue(SECTIONS_STUB as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([
      { categoryId: "cat-1", _sum: { amountCents: 30000n } },
    ] as any);
    prismaMock.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Alimentação" }] as any);

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(typeof result.topCategories[0].totalCents).toBe("string");
    expect(result.topCategories[0].totalCents).toBe("30000");
  });

  it("occurredOn de transações é serializado como string YYYY-MM-DD", async () => {
    prismaMock.section.findMany.mockResolvedValue(SECTIONS_STUB as any);
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        description: "Aluguel",
        occurredOn: new Date("2026-01-15"),
        amountCents: 200000n,
        section: { name: "Saídas", countType: "subtract" },
      },
    ] as any);
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([]);
    prismaMock.category.findMany.mockResolvedValue([]);

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(result.topTransactions[0].occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("retorna sections com countType para o componente de UI", async () => {
    setupEmptyMonth();

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]).toMatchObject({ id: "sec-1", countType: "add" });
  });

  it("inclui chaves para todas as seções em sectionTotals mesmo sem transações", async () => {
    setupEmptyMonth();

    const result = await _getMonthDeepDive("acc-test-1", "month-1");

    expect(Object.keys(result.sectionTotals)).toContain("sec-1");
    expect(Object.keys(result.sectionTotals)).toContain("sec-2");
  });
});

// ─── Spec 38 — novas queries ────────────────────────────────────────────────

describe("getInstitutionBreakdown", () => {
  it("filtra por accountId — multi-tenancy", async () => {
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([]);
    await getInstitutionBreakdown("acc-1", "month-1");
    expect(prismaMock.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-1" }),
      }),
    );
  });

  it("retorna array vazio quando não há transações", async () => {
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([]);
    const result = await getInstitutionBreakdown("acc-1", "month-1");
    expect(result).toHaveLength(0);
  });

  it("serializa totalCents como string (BigInt seguro na fronteira RSC→Client)", async () => {
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([
      { institutionId: "inst-1", _sum: { amountCents: 5000n } },
    ]);
    prismaMock.institution.findMany.mockResolvedValue([{ id: "inst-1", name: "Nubank" }] as any);
    const result = await getInstitutionBreakdown("acc-1", "month-1");
    expect(typeof result[0].totalCents).toBe("string");
    expect(result[0].name).toBe("Nubank");
  });

  it("agrupa transações sem institutionId como 'Sem instituição'", async () => {
    (prismaMock.transaction.groupBy as unknown as Mock).mockResolvedValue([
      { institutionId: null, _sum: { amountCents: 3000n } },
    ]);
    prismaMock.institution.findMany.mockResolvedValue([]);
    const result = await getInstitutionBreakdown("acc-1", "month-1");
    expect(result[0].institutionId).toBeNull();
    expect(result[0].name).toBe("Sem instituição");
  });
});

describe("getWeeklySpending", () => {
  it("filtra por accountId — multi-tenancy", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);
    await getWeeklySpending("acc-1", "month-1", 1, "expense");
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-1" }),
      }),
    );
  });

  it("retorna array vazio quando não há transações", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);
    const result = await getWeeklySpending("acc-1", "month-1", 1, "expense");
    expect(result).toHaveLength(0);
  });

  it("serializa expenseCents e incomeCents como strings", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        occurredOn: new Date("2026-01-05"),
        amountCents: 10000n,
        section: { countType: "subtract" },
      },
    ] as any);
    const result = await getWeeklySpending("acc-1", "month-1", 1, "expense");
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0].expenseCents).toBe("string");
    expect(typeof result[0].incomeCents).toBe("string");
  });
});

describe("getTransactionCount", () => {
  it("filtra por accountId — multi-tenancy", async () => {
    prismaMock.transaction.count.mockResolvedValue(5);
    await getTransactionCount("acc-1", { monthId: "month-1" });
    expect(prismaMock.transaction.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-1" }),
      }),
    );
  });

  it("retorna contagem total sem filtros por padrão", async () => {
    prismaMock.transaction.count.mockResolvedValue(42);
    const result = await getTransactionCount("acc-1", { monthId: "month-1" });
    expect(result).toBe(42);
  });

  it("aplica filtro includePending=false para excluir pendentes", async () => {
    prismaMock.transaction.count.mockResolvedValue(10);
    await getTransactionCount("acc-1", { monthId: "month-1" }, { includePending: false });
    expect(prismaMock.transaction.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPending: false }),
      }),
    );
  });
});

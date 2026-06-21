import { describe, expect, it, type Mock } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import { getMonthDeepDive as _getMonthDeepDive } from "./dashboards";

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
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-1", name: "Alimentação" },
    ] as any);

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

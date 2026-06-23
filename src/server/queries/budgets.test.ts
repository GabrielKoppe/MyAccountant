import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import { getBudgetLabel, getBudgetsWithProgress } from "./budgets";

const BUDGET_STUB = {
  id: "budget-1",
  accountId: "acc-test-1",
  name: null,
  sectionId: null,
  section: null,
  categoryId: "cat-1",
  category: { id: "cat-1", name: "Alimentação" },
  memberUserId: null,
  member: null,
  institutionId: null,
  institution: null,
  tableTypeId: null,
  tableType: null,
  amountCents: 100000n, // R$ 1.000
  alertThresholdPercent: 80,
  isRecurring: true,
  showInSummary: true,
  year: null,
  month: null,
  createdAt: new Date("2026-01-01"),
};

describe("getBudgetLabel (função pura)", () => {
  it("usa name quando definido", () => {
    const budget = {
      ...BUDGET_STUB,
      name: "Meu orçamento",
      amountCents: "100000",
    };
    expect(getBudgetLabel(budget)).toBe("Meu orçamento");
  });

  it("gera label com dimensão e valor quando name é null", () => {
    const budget = { ...BUDGET_STUB, name: null, amountCents: "100000" };
    const label = getBudgetLabel(budget);
    expect(label).toContain("Alimentação");
    expect(label).toContain("R$");
  });

  it("gera label só com valor quando não há dimensões", () => {
    const budget = {
      ...BUDGET_STUB,
      name: null,
      category: null,
      categoryId: null,
      amountCents: "50000",
    };
    const label = getBudgetLabel(budget);
    expect(label).toContain("R$");
  });
});

describe("getBudgetsWithProgress", () => {
  it("retorna [] quando mês não existe", async () => {
    prismaMock.month.findUnique.mockResolvedValue(null);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result).toEqual([]);
    expect(prismaMock.budget.findMany).not.toHaveBeenCalled();
  });

  it("retorna [] quando não há budgets no período", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([]);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result).toEqual([]);
  });

  it("serializa amountCents como string (sem BigInt na fronteira RSC→Client)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([BUDGET_STUB] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { amountCents: 50000n },
    } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);

    expect(typeof result[0].amountCents).toBe("string");
    expect(result[0].amountCents).toBe("100000");
  });

  it("serializa spentCents como string", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([BUDGET_STUB] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { amountCents: 50000n },
    } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);

    expect(typeof result[0].spentCents).toBe("string");
    expect(result[0].spentCents).toBe("50000");
  });

  it("calcula percent correto (50% do orçamento)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([BUDGET_STUB] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { amountCents: 50000n },
    } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result[0].percent).toBe(50);
  });

  it("permite percent > 100 quando orçamento está estourado", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([BUDGET_STUB] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { amountCents: 150000n }, // 150% do orçamento de 100000n
    } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result[0].percent).toBe(150);
  });

  it("retorna 0% e spentCents=0 quando não há transações no período", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([BUDGET_STUB] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { amountCents: null }, // nenhuma transação
    } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result[0].percent).toBe(0);
    expect(result[0].spentCents).toBe("0");
  });

  it("filtra budgets pelo accountId informado", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([]);

    await getBudgetsWithProgress("acc-test-1", 2026, 1);

    expect(prismaMock.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });
});

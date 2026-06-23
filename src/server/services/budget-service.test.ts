import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import { createBudget, updateBudget, deleteBudget, getBudgetTransactions } from "./budget-service";

const BASE_INPUT = {
  name: null,
  sectionId: "sec-1",
  categoryId: undefined,
  memberUserId: undefined,
  institutionId: undefined,
  tableTypeId: undefined,
  amountCents: 50000n,
  alertThresholdPercent: 80,
  isRecurring: true,
  showInSummary: false,
  year: undefined,
  month: undefined,
};

// ─── createBudget ─────────────────────────────────────────────────

describe("createBudget", () => {
  it("deve criar meta com sucesso", async () => {
    prismaMock.budget.create.mockResolvedValue({ id: "budget-1" } as any);

    const result = await createBudget(BASE_INPUT, TEST_CTX);

    expect(result.budgetId).toBe("budget-1");
    expect(prismaMock.budget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          amountCents: 50000n,
          alertThresholdPercent: 80,
          isRecurring: true,
        }),
      }),
    );
  });

  it("deve lançar NotFoundError quando memberUserId não é membro da account", async () => {
    prismaMock.accountMember.findUnique.mockResolvedValue(null);

    await expect(
      createBudget({ ...BASE_INPUT, memberUserId: "user-outro" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.budget.create).not.toHaveBeenCalled();
  });

  it("não deve vazar dados entre tenants (multi-tenancy)", async () => {
    prismaMock.budget.create.mockResolvedValue({ id: "budget-1" } as any);

    await createBudget(BASE_INPUT, { ...TEST_CTX, accountId: "acc-test-1" });

    expect(prismaMock.budget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });
});

// ─── updateBudget ─────────────────────────────────────────────────

describe("updateBudget", () => {
  it("deve atualizar meta com sucesso", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.budget.update.mockResolvedValue({} as any);

    await updateBudget({ ...BASE_INPUT, budgetId: "budget-1" }, TEST_CTX);

    expect(prismaMock.budget.update).toHaveBeenCalled();
  });

  it("não deve atualizar meta de outra account (segurança multi-tenancy)", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(updateBudget({ ...BASE_INPUT, budgetId: "budget-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.budget.update).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando meta não existe", async () => {
    prismaMock.budget.findUnique.mockResolvedValue(null);

    await expect(
      updateBudget({ ...BASE_INPUT, budgetId: "budget-inexistente" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── deleteBudget ─────────────────────────────────────────────────

describe("deleteBudget", () => {
  it("deve deletar meta com sucesso", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.budget.delete.mockResolvedValue({} as any);

    await deleteBudget({ budgetId: "budget-1" }, TEST_CTX);

    expect(prismaMock.budget.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "budget-1" } }),
    );
  });

  it("não deve deletar meta de outra account (segurança multi-tenancy)", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteBudget({ budgetId: "budget-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.budget.delete).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando meta não existe", async () => {
    prismaMock.budget.findUnique.mockResolvedValue(null);

    await expect(deleteBudget({ budgetId: "budget-inexistente" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("getBudgetTransactions", () => {
  it("deve retornar transações e breakdown por categoria", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({
      sectionId: null,
      categoryId: null,
      memberUserId: null,
      institutionId: null,
      tableTypeId: null,
    } as any);

    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        description: "Mercado",
        amountCents: 5000n,
        occurredOn: new Date("2026-01-15"),
        category: { name: "Alimentação" },
        institution: null,
      },
      {
        id: "tx-2",
        description: "Padaria",
        amountCents: 1500n,
        occurredOn: new Date("2026-01-14"),
        category: { name: "Alimentação" },
        institution: null,
      },
    ] as any);

    const result = await getBudgetTransactions(
      { budgetId: "budget-1", monthId: "month-1" },
      TEST_CTX,
    );

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amountCents).toBe("5000");
    expect(result.categoryBreakdown).toHaveLength(1);
    expect(result.categoryBreakdown[0]).toMatchObject({ name: "Alimentação", valueCents: "6500" });
  });

  it("deve lançar NotFoundError quando budget não pertence à account (multi-tenancy)", async () => {
    prismaMock.budget.findUnique.mockResolvedValue(null);

    await expect(
      getBudgetTransactions({ budgetId: "budget-OUTRA", monthId: "month-1" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });

  it("deve aplicar filtro de sectionId quando budget tem seção específica", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({
      sectionId: "sec-123",
      categoryId: null,
      memberUserId: null,
      institutionId: null,
      tableTypeId: null,
    } as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await getBudgetTransactions({ budgetId: "budget-1", monthId: "month-1" }, TEST_CTX);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: "acc-test-1",
          sectionId: "sec-123",
        }),
      }),
    );
  });
});

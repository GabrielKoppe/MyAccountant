import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import { createBudget, updateBudget, deleteBudget } from "./budget-service";

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

    await expect(
      updateBudget({ ...BASE_INPUT, budgetId: "budget-1" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

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

    await expect(
      deleteBudget({ budgetId: "budget-1" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.budget.delete).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando meta não existe", async () => {
    prismaMock.budget.findUnique.mockResolvedValue(null);

    await expect(
      deleteBudget({ budgetId: "budget-inexistente" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });
});

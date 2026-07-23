import { describe, expect, it, beforeEach } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import { createBudget, updateBudget, deleteBudget, getBudgetTransactions } from "./budget-service";

const BASE_INPUT = {
  name: null,
  sectionIds: ["sec-1"],
  categoryIds: [] as string[],
  memberUserIds: [] as string[],
  institutionIds: [] as string[],
  tableTypeIds: [] as string[],
  amountCents: 50000n,
  alertThresholdPercent: 80,
  isRecurring: true,
  showInSummary: false,
  year: undefined,
  month: undefined,
};

// validateDimensions conta por dimensão não-vazia: cada count precisa bater com o
// tamanho do array pra passar. Defaults abaixo fazem toda dimensão validar OK.
beforeEach(() => {
  prismaMock.section.count.mockResolvedValue(1);
  prismaMock.category.count.mockResolvedValue(1);
  prismaMock.institution.count.mockResolvedValue(1);
  prismaMock.tableType.count.mockResolvedValue(1);
  // Dimensão "responsável": validada pela UNIÃO de responsibleParty (partyId novo) +
  // accountMember (userId legado). Defaults vazios; cada teste popula o que precisa.
  prismaMock.responsibleParty.findMany.mockResolvedValue([] as any);
  prismaMock.accountMember.findMany.mockResolvedValue([] as any);
});

// ─── createBudget ─────────────────────────────────────────────────

describe("createBudget", () => {
  it("deve criar orçamento com sucesso (grava arrays)", async () => {
    prismaMock.section.count.mockResolvedValue(1);
    prismaMock.budget.create.mockResolvedValue({ id: "budget-1" } as any);

    const result = await createBudget(BASE_INPUT, TEST_CTX);

    expect(result.budgetId).toBe("budget-1");
    expect(prismaMock.budget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc-test-1",
          sectionIds: ["sec-1"],
          categoryIds: [],
          amountCents: 50000n,
          alertThresholdPercent: 80,
          isRecurring: true,
        }),
      }),
    );
  });

  it("deve lançar NotFoundError quando o responsável não é party nem membro da account", async () => {
    // Nem responsibleParty nem accountMember cobrem o id → inválido.
    prismaMock.responsibleParty.findMany.mockResolvedValue([] as any);
    prismaMock.accountMember.findMany.mockResolvedValue([] as any);

    await expect(
      createBudget({ ...BASE_INPUT, sectionIds: [], memberUserIds: ["party-outra"] }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.budget.create).not.toHaveBeenCalled();
  });

  it("aceita responsável casando por partyId (responsibleParty da account)", async () => {
    // Semântica nova: a dimensão guarda partyId (personal/group/external).
    prismaMock.responsibleParty.findMany.mockResolvedValue([{ id: "party-1" }] as any);
    prismaMock.accountMember.findMany.mockResolvedValue([] as any);
    prismaMock.budget.create.mockResolvedValue({ id: "budget-1" } as any);

    const result = await createBudget(
      { ...BASE_INPUT, sectionIds: [], memberUserIds: ["party-1"] },
      TEST_CTX,
    );

    expect(result.budgetId).toBe("budget-1");
    expect(prismaMock.responsibleParty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1", id: { in: ["party-1"] } },
      }),
    );
    expect(prismaMock.budget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberUserIds: ["party-1"] }),
      }),
    );
  });

  it("tolera responsável legado casando por userId de membro (AccountMember)", async () => {
    // Budget salvo antes da unificação guardava userId; deve continuar válido.
    prismaMock.responsibleParty.findMany.mockResolvedValue([] as any);
    prismaMock.accountMember.findMany.mockResolvedValue([{ userId: "user-legado" }] as any);
    prismaMock.budget.create.mockResolvedValue({ id: "budget-1" } as any);

    const result = await createBudget(
      { ...BASE_INPUT, sectionIds: [], memberUserIds: ["user-legado"] },
      TEST_CTX,
    );

    expect(result.budgetId).toBe("budget-1");
  });

  it("deve lançar NotFoundError quando um id de seção é de outra account (IDOR)", async () => {
    // 2 ids pedidos, mas só 1 pertence à account → mismatch.
    prismaMock.section.count.mockResolvedValue(1);

    await expect(
      createBudget({ ...BASE_INPUT, sectionIds: ["sec-1", "sec-de-outra-acc"] }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);

    expect(prismaMock.budget.create).not.toHaveBeenCalled();
  });

  it("valida cada dimensão contra a account (multi-tenancy)", async () => {
    prismaMock.section.count.mockResolvedValue(1);
    prismaMock.category.count.mockResolvedValue(2);
    prismaMock.budget.create.mockResolvedValue({ id: "budget-1" } as any);

    await createBudget(
      { ...BASE_INPUT, sectionIds: [], categoryIds: ["cat-1", "cat-2"] },
      TEST_CTX,
    );

    expect(prismaMock.category.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-test-1", id: { in: ["cat-1", "cat-2"] } },
      }),
    );
  });

  it("não deve vazar dados entre tenants (accountId no create)", async () => {
    prismaMock.section.count.mockResolvedValue(1);
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
  it("deve atualizar orçamento com sucesso", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.section.count.mockResolvedValue(1);
    prismaMock.budget.update.mockResolvedValue({} as any);

    await updateBudget({ ...BASE_INPUT, budgetId: "budget-1" }, TEST_CTX);

    expect(prismaMock.budget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sectionIds: ["sec-1"] }),
      }),
    );
  });

  it("não deve atualizar orçamento de outra account (segurança multi-tenancy)", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(updateBudget({ ...BASE_INPUT, budgetId: "budget-1" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );

    expect(prismaMock.budget.update).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando orçamento não existe", async () => {
    prismaMock.budget.findUnique.mockResolvedValue(null);

    await expect(
      updateBudget({ ...BASE_INPUT, budgetId: "budget-inexistente" }, TEST_CTX),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── deleteBudget ─────────────────────────────────────────────────

describe("deleteBudget", () => {
  it("deve deletar orçamento com sucesso", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-test-1" } as any);
    prismaMock.budget.delete.mockResolvedValue({} as any);

    await deleteBudget({ budgetId: "budget-1" }, TEST_CTX);

    expect(prismaMock.budget.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "budget-1" } }),
    );
  });

  it("não deve deletar orçamento de outra account (segurança multi-tenancy)", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(deleteBudget({ budgetId: "budget-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);

    expect(prismaMock.budget.delete).not.toHaveBeenCalled();
  });

  it("deve lançar NotFoundError quando orçamento não existe", async () => {
    prismaMock.budget.findUnique.mockResolvedValue(null);

    await expect(deleteBudget({ budgetId: "budget-inexistente" }, TEST_CTX)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("getBudgetTransactions", () => {
  it("deve retornar transações e breakdown por categoria", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({
      sectionIds: [],
      categoryIds: [],
      memberUserIds: [],
      institutionIds: [],
      tableTypeIds: [],
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

  it("aplica filtro sectionId { in } quando o orçamento tem seções", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({
      sectionIds: ["sec-123", "sec-456"],
      categoryIds: [],
      memberUserIds: [],
      institutionIds: [],
      tableTypeIds: [],
    } as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await getBudgetTransactions({ budgetId: "budget-1", monthId: "month-1" }, TEST_CTX);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: "acc-test-1",
          sectionId: { in: ["sec-123", "sec-456"] },
        }),
      }),
    );
  });

  it("dimensão responsável: filtra responsiblePartyId resolvido por partyId", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({
      sectionIds: [],
      categoryIds: [],
      memberUserIds: ["party-1"],
      institutionIds: [],
      tableTypeIds: [],
    } as any);
    // budgetDimensionWhere → responsiblePartyIdsForFilter: partyId direto + legado.
    prismaMock.responsibleParty.findMany.mockResolvedValue([{ id: "party-1" }] as any);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([] as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await getBudgetTransactions({ budgetId: "budget-1", monthId: "month-1" }, TEST_CTX);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ responsiblePartyId: { in: ["party-1"] } }),
      }),
    );
  });

  it("aceita monthId no formato uuid (dados legados do MVP) e repassa ao filtro", async () => {
    const uuidMonthId = "3f0e6b2a-1c4d-4a9b-8e2f-0a1b2c3d4e5f";
    prismaMock.budget.findUnique.mockResolvedValue({
      sectionIds: [],
      categoryIds: [],
      memberUserIds: [],
      institutionIds: [],
      tableTypeIds: [],
    } as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await getBudgetTransactions({ budgetId: "budget-1", monthId: uuidMonthId }, TEST_CTX);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ monthId: uuidMonthId }),
      }),
    );
  });

  it("intersecção AND entre dimensões: categoria + instituição viram dois filtros in", async () => {
    prismaMock.budget.findUnique.mockResolvedValue({
      sectionIds: [],
      categoryIds: ["cat-1"],
      memberUserIds: [],
      institutionIds: ["inst-1", "inst-2"],
      tableTypeIds: [],
    } as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await getBudgetTransactions({ budgetId: "budget-1", monthId: "month-1" }, TEST_CTX);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryId: { in: ["cat-1"] },
          institutionId: { in: ["inst-1", "inst-2"] },
          // sectionIds vazio → exclui seções "ignore" em vez de restringir a seção.
          section: { countType: { not: "ignore" } },
        }),
      }),
    );
  });
});

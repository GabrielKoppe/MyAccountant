import { beforeEach, describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import {
  getBudgetLabel,
  getBudgetsConfigWithHistory,
  getBudgetsWithProgress,
  type BudgetWithDetails,
} from "./budgets";

// Raw row como o prisma.budget.findMany devolve (arrays de ids, amountCents bigint).
const RAW_BUDGET = {
  id: "budget-1",
  accountId: "acc-test-1",
  name: null,
  sectionIds: [] as string[],
  categoryIds: ["cat-1"],
  memberUserIds: [] as string[],
  institutionIds: [] as string[],
  tableTypeIds: [] as string[],
  amountCents: 100000n, // R$ 1.000
  alertThresholdPercent: 80,
  isRecurring: true,
  showInSummary: true,
  year: null,
  month: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// BudgetWithDetails já serializado (arrays de ids + nomes resolvidos) para os testes puros.
const DETAILS_STUB: BudgetWithDetails = {
  id: "budget-1",
  name: null,
  sectionIds: [],
  categoryIds: ["cat-1"],
  memberUserIds: [],
  institutionIds: [],
  tableTypeIds: [],
  sections: [],
  categories: [{ id: "cat-1", name: "Alimentação" }],
  members: [],
  institutions: [],
  tableTypes: [],
  amountCents: "100000",
  alertThresholdPercent: 80,
  isRecurring: true,
  showInSummary: true,
  year: null,
  month: null,
};

beforeEach(() => {
  // loadDimensionMaps: section/category/institution/tableType findMany + partyDisplayMap
  // (que faz responsibleParty.findMany + accountMember.findMany). Defaults resolvem cat-1.
  prismaMock.section.findMany.mockResolvedValue([] as any);
  prismaMock.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Alimentação" }] as any);
  prismaMock.institution.findMany.mockResolvedValue([] as any);
  prismaMock.tableType.findMany.mockResolvedValue([] as any);
  // partyDisplayMap: sem parties/membros por padrão.
  prismaMock.responsibleParty.findMany.mockResolvedValue([] as any);
  prismaMock.accountMember.findMany.mockResolvedValue([] as any);
});

describe("getBudgetLabel (função pura)", () => {
  it("usa name quando definido", () => {
    expect(getBudgetLabel({ ...DETAILS_STUB, name: "Meu orçamento" })).toBe("Meu orçamento");
  });

  it("gera label com nome da dimensão e valor quando name é null", () => {
    const label = getBudgetLabel(DETAILS_STUB);
    expect(label).toContain("Alimentação");
    expect(label).toContain("R$");
  });

  it("junta múltiplos ids da mesma dimensão com vírgula", () => {
    const label = getBudgetLabel({
      ...DETAILS_STUB,
      categories: [
        { id: "cat-1", name: "Alimentação" },
        { id: "cat-2", name: "Transporte" },
      ],
    });
    expect(label).toContain("Alimentação, Transporte");
  });

  it("separa dimensões distintas com ' · '", () => {
    const label = getBudgetLabel({
      ...DETAILS_STUB,
      categories: [{ id: "cat-1", name: "Alimentação" }],
      institutions: [{ id: "inst-1", name: "Nubank" }],
    });
    expect(label).toContain("Alimentação · Nubank");
  });

  it("gera label só com valor quando não há dimensões resolvidas", () => {
    const label = getBudgetLabel({ ...DETAILS_STUB, categoryIds: [], categories: [] });
    expect(label).toContain("R$");
  });
});

describe("getBudgetsWithProgress", () => {
  it("lista os budgets com gasto 0 quando o mês corrente ainda não existe (regressão: antes escondia TODOS)", async () => {
    // Conta sem a `Month` do mês vigente aberta: transação não existe sem Month → gasto 0,
    // mas os orçamentos configurados DEVEM aparecer. Antes um `if (!monthRecord) return []`
    // devolvia lista vazia, escondendo todos os orçamentos até o mês ser criado.
    prismaMock.month.findUnique.mockResolvedValue(null);
    prismaMock.budget.findMany.mockResolvedValue([RAW_BUDGET] as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result).toHaveLength(1);
    expect(result[0].spentCents).toBe("0");
    // Sem Month não há transações no período → nem consulta o agregado.
    expect(prismaMock.transaction.aggregate).not.toHaveBeenCalled();
  });

  it("retorna [] quando não há budgets no período", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([]);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result).toEqual([]);
  });

  it("serializa amountCents/spentCents como string e expõe arrays + nomes resolvidos", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([RAW_BUDGET] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountCents: 50000n } } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);

    expect(typeof result[0].amountCents).toBe("string");
    expect(result[0].amountCents).toBe("100000");
    expect(typeof result[0].spentCents).toBe("string");
    expect(result[0].spentCents).toBe("50000");
    expect(result[0].categoryIds).toEqual(["cat-1"]);
    expect(result[0].categories).toEqual([{ id: "cat-1", name: "Alimentação" }]);
  });

  it("filtra ids órfãos dos nomes resolvidos (categoria deletada)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([
      { ...RAW_BUDGET, categoryIds: ["cat-1", "cat-deletada"] },
    ] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountCents: 0n } } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);

    // Os dois ids continuam persistidos, mas só o resolvível vira nome.
    expect(result[0].categoryIds).toEqual(["cat-1", "cat-deletada"]);
    expect(result[0].categories).toEqual([{ id: "cat-1", name: "Alimentação" }]);
  });

  it("calcula percent correto (50% do orçamento)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([RAW_BUDGET] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountCents: 50000n } } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result[0].percent).toBe(50);
  });

  it("permite percent > 100 quando orçamento está estourado", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([RAW_BUDGET] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountCents: 150000n } } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result[0].percent).toBe(150);
  });

  it("retorna 0% e spentCents=0 quando não há transações no período", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([RAW_BUDGET] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountCents: null } } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);
    expect(result[0].percent).toBe(0);
    expect(result[0].spentCents).toBe("0");
  });

  it("agrega com categoryId { in } (interseção OU dentro da dimensão)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([
      { ...RAW_BUDGET, categoryIds: ["cat-1", "cat-2"] },
    ] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountCents: 0n } } as any);

    await getBudgetsWithProgress("acc-test-1", 2026, 1);

    expect(prismaMock.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: "acc-test-1",
          monthId: "month-1",
          categoryId: { in: ["cat-1", "cat-2"] },
        }),
      }),
    );
  });

  it("dimensão responsável: resolve NOME por partyId e filtra responsiblePartyId (Parte A)", async () => {
    prismaMock.month.findUnique.mockResolvedValue({ id: "month-1" } as any);
    prismaMock.budget.findMany.mockResolvedValue([
      { ...RAW_BUDGET, categoryIds: [], memberUserIds: ["party-1"] },
    ] as any);
    // responsibleParty.findMany atende tanto partyDisplayMap (nome) quanto
    // responsiblePartyIdsForFilter (resolução do partyId → responsiblePartyId).
    prismaMock.responsibleParty.findMany.mockResolvedValue([
      { id: "party-1", name: "Fulano", kind: "group", members: [] },
    ] as any);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([] as any);
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountCents: 0n } } as any);

    const result = await getBudgetsWithProgress("acc-test-1", 2026, 1);

    // Nome vem de partyDisplayMap (por partyId), não mais de accountMember.
    expect(result[0].memberUserIds).toEqual(["party-1"]);
    expect(result[0].members).toEqual([{ id: "party-1", name: "Fulano" }]);
    // O filtro casa por responsiblePartyId ∈ parties resolvidas.
    expect(prismaMock.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ responsiblePartyId: { in: ["party-1"] } }),
      }),
    );
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

describe("getBudgetsConfigWithHistory", () => {
  // Months da account em ordem desc (como o findMany retorna); a query reverte p/ ascendente.
  const MONTHS_DESC = [
    { id: "month-3", year: 2026, month: 3 },
    { id: "month-2", year: 2026, month: 2 },
    { id: "month-1", year: 2026, month: 1 },
  ];

  // Gasto por monthId — dirige o status: 50%→ok, 90%→alert(≥80), 150%→exceeded(≥100).
  const spentByMonth: Record<string, bigint> = {
    "month-1": 50000n,
    "month-2": 90000n,
    "month-3": 150000n,
  };

  function mockAggregateByMonth() {
    prismaMock.transaction.aggregate.mockImplementation((args: any) =>
      Promise.resolve({
        _sum: { amountCents: spentByMonth[args.where.monthId] ?? 0n },
      }) as any,
    );
  }

  it("orçamento recorrente: status em TODOS os meses (ok/alert/exceeded), ascendente", async () => {
    prismaMock.month.findMany.mockResolvedValue(MONTHS_DESC as any);
    prismaMock.budget.findMany.mockResolvedValue([RAW_BUDGET] as any); // isRecurring: true
    mockAggregateByMonth();

    const [budget] = await getBudgetsConfigWithHistory("acc-test-1");

    // Config serializada reusa serializeBudget (BigInt → string, nomes resolvidos).
    expect(budget.amountCents).toBe("100000");
    expect(budget.categories).toEqual([{ id: "cat-1", name: "Alimentação" }]);

    // Um entry por mês, do mais antigo → mais recente.
    expect(budget.history).toEqual([
      { year: 2026, month: 1, monthId: "month-1", status: "ok", percent: 50, spentCents: "50000" },
      {
        year: 2026,
        month: 2,
        monthId: "month-2",
        status: "alert",
        percent: 90,
        spentCents: "90000",
      },
      {
        year: 2026,
        month: 3,
        monthId: "month-3",
        status: "exceeded",
        percent: 150,
        spentCents: "150000",
      },
    ]);
  });

  it("orçamento específico: history só no seu próprio year/month", async () => {
    prismaMock.month.findMany.mockResolvedValue(MONTHS_DESC as any);
    prismaMock.budget.findMany.mockResolvedValue([
      { ...RAW_BUDGET, isRecurring: false, year: 2026, month: 2 },
    ] as any);
    mockAggregateByMonth();

    const [budget] = await getBudgetsConfigWithHistory("acc-test-1");

    expect(budget.history).toEqual([
      {
        year: 2026,
        month: 2,
        monthId: "month-2",
        status: "alert",
        percent: 90,
        spentCents: "90000",
      },
    ]);
    // Só o mês do orçamento é agregado; meses fora do período não são consultados.
    expect(prismaMock.transaction.aggregate).toHaveBeenCalledTimes(1);
  });

  it("filtra budgets e months pelo accountId (multi-tenancy)", async () => {
    prismaMock.month.findMany.mockResolvedValue([]);
    prismaMock.budget.findMany.mockResolvedValue([]);

    await getBudgetsConfigWithHistory("acc-test-1");

    expect(prismaMock.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-test-1" }) }),
    );
    expect(prismaMock.month.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-test-1" }) }),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";

import {
  getArchivedGoals,
  getGoalDetail,
  getGoalDimensionOptions,
  getGoalsOverview,
  getGoalsWidgetData,
  getGoalSuggestions,
} from "./goals";

const ACCOUNT_ID = "acc-test-1";
const OTHER_ACCOUNT_ID = "acc-other-1";

function settingsRow(monthStartDay = 1) {
  return { monthStartDay };
}

function contribution(overrides: Record<string, unknown> = {}) {
  return {
    id: "contrib-1",
    accountId: ACCOUNT_ID,
    goalId: "goal-1",
    amountCents: 10000n,
    contributedOn: new Date("2026-07-01"),
    byUserId: "user-1",
    byUser: { name: "Gabriel" },
    responsiblePartyId: null,
    transactionId: null,
    notes: null,
    createdAt: new Date("2026-07-01"),
    ...overrides,
  };
}

function goalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "goal-1",
    accountId: ACCOUNT_ID,
    name: "Viagem ao Japão",
    targetCents: 100000n,
    deadline: null,
    sectionId: null,
    categoryId: null,
    isAchieved: false,
    archivedAt: null,
    createdById: "user-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    contributions: [] as ReturnType<typeof contribution>[],
    ...overrides,
  };
}

// Data fixa (meio de mês — evita sensibilidade a timezone/borda de mês do runner de CI):
// os testes não devem depender da data real de execução (a query usa `new Date()`
// internamente para o mês fiscal corrente, espelhando net-worth.ts/cashflow-forecast.ts).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-22T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── getGoalsOverview ───────────────────────────────────────────────────────

describe("getGoalsOverview", () => {
  it("filtra metas ativas (archivedAt: null) pelo accountId informado", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([]);

    await getGoalsOverview(ACCOUNT_ID);

    expect(prismaMock.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: ACCOUNT_ID, archivedAt: null }),
      }),
    );
    expect(prismaMock.accountSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: ACCOUNT_ID } }),
    );
  });

  it("nenhum BigInt cru cruza a fronteira — todo *Cents serializado como string", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([
      goalRow({ contributions: [contribution({ amountCents: 30000n })] }),
    ] as any);

    const result = await getGoalsOverview(ACCOUNT_ID);

    expect(typeof result.totalSavedCents).toBe("string");
    expect(typeof result.totalTargetCents).toBe("string");
    expect(typeof result.contributedThisMonthCents).toBe("string");
    expect(result.totalSavedCents).toBe("30000");
    expect(result.totalTargetCents).toBe("100000");
    expect(typeof result.goals[0].targetCents).toBe("string");
    expect(typeof result.goals[0].progressCents).toBe("string");
    expect(
      result.goals[0].requiredMonthlyCents === null ||
        typeof result.goals[0].requiredMonthlyCents === "string",
    ).toBe(true);
  });

  it("marca achieved e conta no balde 'achieved' quando Σ contribuições >= alvo", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([
      goalRow({ contributions: [contribution({ amountCents: 100000n })] }),
    ] as any);

    const result = await getGoalsOverview(ACCOUNT_ID);

    expect(result.goals[0].isAchieved).toBe(true);
    expect(result.goals[0].pace).toBe("achieved");
    expect(result.counts.achieved).toBe(1);
    expect(result.counts.behind).toBe(0);
  });

  it("usa monthStartDay=1 (default) quando accountSettings ainda não existe (conta nova)", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(null);
    prismaMock.goal.findMany.mockResolvedValue([]);

    await expect(getGoalsOverview(ACCOUNT_ID)).resolves.toBeDefined();
  });

  it("serializa nextDeadlineGoal.deadline como YYYY-MM-DD", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([
      goalRow({ id: "goal-1", deadline: new Date("2026-12-25"), contributions: [] }),
    ] as any);

    const result = await getGoalsOverview(ACCOUNT_ID);

    expect(result.nextDeadlineGoal).toEqual({ id: "goal-1", deadline: "2026-12-25" });
  });
});

// ─── getArchivedGoals ───────────────────────────────────────────────────────

describe("getArchivedGoals", () => {
  it("filtra metas arquivadas (archivedAt not null) pelo accountId informado", async () => {
    prismaMock.goal.findMany.mockResolvedValue([]);

    await getArchivedGoals(ACCOUNT_ID);

    expect(prismaMock.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: ACCOUNT_ID, archivedAt: { not: null } }),
      }),
    );
  });

  it("serialização leve: pace só achieved/no_contribution, sem requiredMonthlyCents/projectedMonth", async () => {
    prismaMock.goal.findMany.mockResolvedValue([
      goalRow({ id: "goal-sem-aporte", archivedAt: new Date("2026-06-01"), contributions: [] }),
      goalRow({
        id: "goal-atingida",
        archivedAt: new Date("2026-06-01"),
        contributions: [contribution({ amountCents: 100000n })],
      }),
    ] as any);

    const result = await getArchivedGoals(ACCOUNT_ID);

    const semAporte = result.find((g) => g.id === "goal-sem-aporte")!;
    const atingida = result.find((g) => g.id === "goal-atingida")!;

    expect(semAporte.pace).toBe("no_contribution");
    expect(semAporte.requiredMonthlyCents).toBeNull();
    expect(semAporte.projectedMonth).toBeNull();

    expect(atingida.pace).toBe("achieved");
    expect(atingida.isAchieved).toBe(true);
    expect(typeof atingida.progressCents).toBe("string");
    expect(atingida.progressCents).toBe("100000");
  });

  it("não vaza metas arquivadas de outra account (accountId sempre no where)", async () => {
    prismaMock.goal.findMany.mockResolvedValue([]);

    await getArchivedGoals(ACCOUNT_ID);

    for (const call of prismaMock.goal.findMany.mock.calls) {
      expect(call[0]?.where).toMatchObject({ accountId: ACCOUNT_ID });
    }
  });
});

// ─── getGoalDetail ──────────────────────────────────────────────────────────

describe("getGoalDetail", () => {
  it("retorna null quando a meta não existe ou não pertence à account (multi-tenancy)", async () => {
    prismaMock.goal.findFirst.mockResolvedValue(null);

    const result = await getGoalDetail(OTHER_ACCOUNT_ID, "goal-de-outra-account");

    expect(result).toBeNull();
    expect(prismaMock.goal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "goal-de-outra-account",
          accountId: OTHER_ACCOUNT_ID,
        }),
      }),
    );
  });

  it("compõe glide-path + split por membro + histórico, com cents/datas como string", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findFirst.mockResolvedValue(
      goalRow({
        deadline: new Date("2026-12-01"),
        createdAt: new Date("2026-01-01"),
        contributions: [
          contribution({
            id: "c1",
            byUserId: "user-1",
            byUser: { name: "Gabriel" },
            amountCents: 30000n,
            contributedOn: new Date("2026-03-01"),
          }),
          contribution({
            id: "c2",
            byUserId: "user-2",
            byUser: { name: "Ana" },
            amountCents: 20000n,
            contributedOn: new Date("2026-05-01"),
          }),
        ],
      }) as any,
    );

    const result = await getGoalDetail(ACCOUNT_ID, "goal-1");

    expect(result).not.toBeNull();
    expect(result!.goal.progressCents).toBe("50000");
    expect(typeof result!.goal.targetCents).toBe("string");

    expect(result!.glidePath.length).toBeGreaterThan(0);
    expect(typeof result!.glidePath[0].cumulativeCents).toBe("string");
    expect(typeof result!.glidePath[0].targetCents).toBe("string");

    expect(result!.split).toHaveLength(2);
    const gabrielSplit = result!.split.find((s) => s.userId === "user-1");
    expect(gabrielSplit?.totalCents).toBe("30000");
    expect(typeof gabrielSplit?.percent).toBe("number");

    expect(result!.history).toHaveLength(2);
    expect(typeof result!.history[0].amountCents).toBe("string");
    expect(result!.history[0].contributedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result!.history.map((h) => h.byUserName).sort()).toEqual(["Ana", "Gabriel"]);
  });

  it("nunca faz findUnique por id cru — sempre filtra accountId no mesmo where", async () => {
    prismaMock.goal.findFirst.mockResolvedValue(null);

    await getGoalDetail(ACCOUNT_ID, "goal-1");

    expect(prismaMock.goal.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.goal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "goal-1", accountId: ACCOUNT_ID } }),
    );
  });
});

// ─── getGoalSuggestions ─────────────────────────────────────────────────────

describe("getGoalSuggestions", () => {
  it("retorna dimensionLabel:null e suggestions:[] quando a meta não existe ou não é da account (sem vazar transações)", async () => {
    prismaMock.goal.findFirst.mockResolvedValue(null);

    const result = await getGoalSuggestions(OTHER_ACCOUNT_ID, "goal-de-outra-account");

    expect(result).toEqual({ dimensionLabel: null, suggestions: [] });
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
  });

  it("retorna dimensionLabel:null e suggestions:[] quando a meta não tem dimensão (sectionId e categoryId ambos null — GOAL-05)", async () => {
    prismaMock.goal.findFirst.mockResolvedValue({
      sectionId: null,
      categoryId: null,
      section: null,
      category: null,
    } as any);

    const result = await getGoalSuggestions(ACCOUNT_ID, "goal-1");

    expect(result).toEqual({ dimensionLabel: null, suggestions: [] });
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    // dimensão é checada ANTES de resolver os meses — nenhuma query extra disparada.
    expect(prismaMock.month.findMany).not.toHaveBeenCalled();
  });

  it("preserva o dimensionLabel já resolvido quando a account não tem nenhum Month (conta nova)", async () => {
    prismaMock.goal.findFirst.mockResolvedValue({
      sectionId: "sec-1",
      categoryId: null,
      section: { name: "Poupança" },
      category: null,
    } as any);
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.month.findMany.mockResolvedValue([]);

    const result = await getGoalSuggestions(ACCOUNT_ID, "goal-1");

    expect(result).toEqual({ dimensionLabel: "Poupança", suggestions: [] });
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
  });

  it("filtra por sectionId da meta, mês fiscal corrente, amountCents>0 e sem GoalContribution vinculada; resolve dimensionLabel via section.name", async () => {
    prismaMock.goal.findFirst.mockResolvedValue({
      sectionId: "sec-1",
      categoryId: null,
      section: { name: "Poupança" },
      category: null,
    } as any);
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.month.findMany.mockResolvedValue([{ id: "month-1" }] as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const result = await getGoalSuggestions(ACCOUNT_ID, "goal-1");

    expect(result.dimensionLabel).toBe("Poupança");
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: ACCOUNT_ID,
          monthId: { in: ["month-1"] },
          amountCents: { gt: 0n },
          sectionId: "sec-1",
          goalContributions: { none: {} },
        }),
      }),
    );
  });

  it("filtra por categoryId quando a meta usa categoria em vez de seção; resolve dimensionLabel via category.name", async () => {
    prismaMock.goal.findFirst.mockResolvedValue({
      sectionId: null,
      categoryId: "cat-1",
      section: null,
      category: { name: "Lazer" },
    } as any);
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.month.findMany.mockResolvedValue([{ id: "month-1" }] as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const result = await getGoalSuggestions(ACCOUNT_ID, "goal-1");

    expect(result.dimensionLabel).toBe("Lazer");
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: "cat-1" }),
      }),
    );
  });

  it("serializa amountCents como string (magnitude) e occurredOn como YYYY-MM-DD", async () => {
    prismaMock.goal.findFirst.mockResolvedValue({
      sectionId: "sec-1",
      categoryId: null,
      section: { name: "Poupança" },
      category: null,
    } as any);
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.month.findMany.mockResolvedValue([{ id: "month-1" }] as any);
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        amountCents: 5000n,
        occurredOn: new Date("2026-07-10"),
        description: "Poupança",
      },
    ] as any);

    const result = await getGoalSuggestions(ACCOUNT_ID, "goal-1");

    expect(result).toEqual({
      dimensionLabel: "Poupança",
      suggestions: [
        { id: "tx-1", amountCents: "5000", occurredOn: "2026-07-10", description: "Poupança" },
      ],
    });
  });

  it("varre a janela dos últimos meses existentes (não só o corrente) e limita a quantidade", async () => {
    prismaMock.goal.findFirst.mockResolvedValue({
      sectionId: "sec-1",
      categoryId: null,
      section: { name: "Poupança" },
      category: null,
    } as any);
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    // Conta com jun + mai (SEM o mês corrente jul) — a sugestão deve olhar esses meses.
    prismaMock.month.findMany.mockResolvedValue([{ id: "m-jun" }, { id: "m-mai" }] as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await getGoalSuggestions(ACCOUNT_ID, "goal-1");

    expect(prismaMock.month.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: ACCOUNT_ID },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 6,
      }),
    );
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ monthId: { in: ["m-jun", "m-mai"] } }),
        take: 50,
      }),
    );
  });
});

// ─── getGoalsWidgetData ─────────────────────────────────────────────────────

describe("getGoalsWidgetData", () => {
  it("filtra metas ativas pelo accountId informado (sem parâmetro `year` — estado-corrente)", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([]);

    const result = await getGoalsWidgetData(ACCOUNT_ID);

    expect(prismaMock.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: ACCOUNT_ID, archivedAt: null }),
      }),
    );
    expect(result.goals).toEqual([]);
    expect(result.glidePath).toBeNull();
    expect(result.nearestDeadlineGoalId).toBeNull();
  });

  it("ordena por deadline mais próximo primeiro e compõe o glide-path dessa meta", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([
      goalRow({ id: "goal-far", deadline: new Date("2027-12-01"), contributions: [] }),
      goalRow({
        id: "goal-near",
        deadline: new Date("2026-08-01"),
        createdAt: new Date("2026-01-01"),
        contributions: [
          contribution({ amountCents: 10000n, contributedOn: new Date("2026-07-01") }),
        ],
      }),
      goalRow({ id: "goal-no-deadline", deadline: null, contributions: [] }),
    ] as any);

    const result = await getGoalsWidgetData(ACCOUNT_ID);

    expect(result.goals.map((g) => g.id)).toEqual(["goal-near", "goal-far", "goal-no-deadline"]);
    expect(result.nearestDeadlineGoalId).toBe("goal-near");
    expect(result.glidePath).not.toBeNull();
    expect(result.glidePath!.length).toBeGreaterThan(0);
    expect(typeof result.glidePath![0].cumulativeCents).toBe("string");
  });

  it("glidePath fica null quando nenhuma meta ativa tem deadline", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([
      goalRow({ id: "goal-1", deadline: null, contributions: [] }),
    ] as any);

    const result = await getGoalsWidgetData(ACCOUNT_ID);

    expect(result.nearestDeadlineGoalId).toBeNull();
    expect(result.glidePath).toBeNull();
  });

  it("contributedThisMonthCents serializado como string", async () => {
    prismaMock.accountSettings.findUnique.mockResolvedValue(settingsRow() as any);
    prismaMock.goal.findMany.mockResolvedValue([
      goalRow({
        contributions: [
          contribution({ amountCents: 15000n, contributedOn: new Date("2026-07-15") }),
        ],
      }),
    ] as any);

    const result = await getGoalsWidgetData(ACCOUNT_ID);

    expect(typeof result.contributedThisMonthCents).toBe("string");
    expect(result.contributedThisMonthCents).toBe("15000");
  });
});

// ─── getGoalDimensionOptions ────────────────────────────────────────────────

describe("getGoalDimensionOptions", () => {
  it("filtra seções e categorias pelo accountId informado (multi-tenancy)", async () => {
    prismaMock.section.findMany.mockResolvedValue([]);
    prismaMock.category.findMany.mockResolvedValue([]);

    await getGoalDimensionOptions(ACCOUNT_ID);

    expect(prismaMock.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: ACCOUNT_ID, isActive: true } }),
    );
    expect(prismaMock.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: ACCOUNT_ID } }),
    );
  });

  it("retorna sections/categories combinadas, só com id/name", async () => {
    prismaMock.section.findMany.mockResolvedValue([{ id: "sec-1", name: "Poupança" }] as any);
    prismaMock.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Investimentos" }] as any);

    const result = await getGoalDimensionOptions(ACCOUNT_ID);

    expect(result).toEqual({
      sections: [{ id: "sec-1", name: "Poupança" }],
      categories: [{ id: "cat-1", name: "Investimentos" }],
    });
  });
});

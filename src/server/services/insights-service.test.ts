import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { getInsightsData } from "@/server/queries/insights";
import {
  detectCategorySpikes,
  detectNewCategories,
  detectBudgetRisk,
  detectSustainedAdherence,
  orchestrate,
} from "./insights-service";

const HREF = "/acc-test-1/settings/budgets";

// ─── INS-01 — Pico de gasto por categoria ─────────────────────────

describe("detectCategorySpikes", () => {
  it("gera warning quando atual ≥ 1.25× média, delta ≥ R$50 e há histórico", () => {
    const result = detectCategorySpikes({
      current: new Map([["food", { name: "Alimentação", cents: 20000n }]]),
      prior: new Map([["food", [10000n, 10000n, 10000n]]]),
    });

    expect(result).toHaveLength(1);
    expect(result[0].insight.severity).toBe("warning");
    expect(result[0].insight.id).toBe("spike:food");
    expect(result[0].rank).toBe(100); // +100%
  });

  it("não gera quando não há mês anterior com dados", () => {
    const result = detectCategorySpikes({
      current: new Map([["food", { name: "Alimentação", cents: 99999n }]]),
      prior: new Map(),
    });
    expect(result).toHaveLength(0);
  });

  it("não gera quando o delta absoluto é < R$50", () => {
    const result = detectCategorySpikes({
      current: new Map([["food", { name: "Alimentação", cents: 10400n }]]),
      prior: new Map([["food", [10000n]]]),
    });
    expect(result).toHaveLength(0);
  });

  it("não gera quando o aumento é < 25% (mesmo com delta ≥ R$50)", () => {
    const result = detectCategorySpikes({
      current: new Map([["food", { name: "Alimentação", cents: 120000n }]]),
      prior: new Map([["food", [100000n]]]), // +20%, delta R$200
    });
    expect(result).toHaveLength(0);
  });
});

// ─── INS-02 — Categoria nova ──────────────────────────────────────

describe("detectNewCategories", () => {
  it("gera info quando a categoria tem gasto agora e nenhum histórico", () => {
    const result = detectNewCategories({
      current: new Map([["coffee", { name: "Café", cents: 8000n }]]),
      prior: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].insight.severity).toBe("info");
    expect(result[0].insight.id).toBe("new:coffee");
  });

  it("não classifica como nova se houve gasto em meses anteriores", () => {
    const result = detectNewCategories({
      current: new Map([["food", { name: "Alimentação", cents: 8000n }]]),
      prior: new Map([["food", [5000n]]]),
    });
    expect(result).toHaveLength(0);
  });

  it("ignora categorias sem gasto no mês atual", () => {
    const result = detectNewCategories({
      current: new Map([["x", { name: "X", cents: 0n }]]),
      prior: new Map(),
    });
    expect(result).toHaveLength(0);
  });
});

// ─── INS-03 — Risco de estouro de meta ────────────────────────────

describe("detectBudgetRisk", () => {
  it("gera warning com dias restantes no mês atual", () => {
    const result = detectBudgetRisk({
      budgets: [{ id: "b1", label: "Alimentação", percent: 85 }],
      isCurrentMonth: true,
      daysRemaining: 9,
      budgetsHref: HREF,
    });
    expect(result).toHaveLength(1);
    expect(result[0].insight.severity).toBe("warning");
    expect(result[0].insight.action?.href).toBe(HREF);
    expect(result[0].insight.body).toContain("9 dias");
  });

  it("usa texto retrospectivo em mês histórico (sem dias restantes)", () => {
    const result = detectBudgetRisk({
      budgets: [{ id: "b1", label: "Alimentação", percent: 85 }],
      isCurrentMonth: false,
      daysRemaining: null,
      budgetsHref: HREF,
    });
    expect(result).toHaveLength(1);
    expect(result[0].insight.body).not.toContain("dias");
  });

  it("não gera abaixo de 70% nem em 100%+", () => {
    expect(
      detectBudgetRisk({
        budgets: [
          { id: "low", label: "L", percent: 50 },
          { id: "over", label: "O", percent: 100 },
        ],
        isCurrentMonth: true,
        daysRemaining: 5,
        budgetsHref: HREF,
      }),
    ).toHaveLength(0);
  });
});

// ─── INS-04 — Aderência sustentada ────────────────────────────────

describe("detectSustainedAdherence", () => {
  it("gera success com 3 meses dentro do limite", () => {
    const result = detectSustainedAdherence({
      history: [{ id: "b1", label: "Alimentação", percents: [50, 60, 70] }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].insight.severity).toBe("success");
    expect(result[0].insight.id).toBe("adherence:b1");
  });

  it("não gera com menos de 3 meses de histórico", () => {
    const result = detectSustainedAdherence({
      history: [{ id: "b1", label: "X", percents: [50, 60] }],
    });
    expect(result).toHaveLength(0);
  });

  it("não gera se estourou em algum dos meses", () => {
    const result = detectSustainedAdherence({
      history: [{ id: "b1", label: "X", percents: [50, 120, 60] }],
    });
    expect(result).toHaveLength(0);
  });
});

// ─── Orquestração e priorização ───────────────────────────────────

describe("orchestrate", () => {
  it("ordena warning > success > info, por relevância, e corta em 5", () => {
    const ranked = [
      ...detectBudgetRisk({
        budgets: [
          { id: "b1", label: "B1", percent: 85 },
          { id: "b2", label: "B2", percent: 72 },
          { id: "b3", label: "B3", percent: 99 },
        ],
        isCurrentMonth: true,
        daysRemaining: 3,
        budgetsHref: HREF,
      }),
      ...detectSustainedAdherence({
        history: [{ id: "a1", label: "A1", percents: [10, 20, 30] }],
      }),
      ...detectNewCategories({
        current: new Map([
          ["big", { name: "Big", cents: 9000n }],
          ["small", { name: "Small", cents: 5000n }],
        ]),
        prior: new Map(),
      }),
    ];

    const result = orchestrate(ranked);

    expect(result).toHaveLength(5); // 3 warning + 1 success + 2 info = 6, cortado em 5
    expect(result.map((i) => i.severity)).toEqual([
      "warning",
      "warning",
      "warning",
      "success",
      "info",
    ]);
    expect(result[0].id).toBe("budget-risk:b3"); // maior percentual primeiro
    expect(result[4].id).toBe("new:big"); // info de maior valor sobrevive ao corte
  });
});

// ─── Multi-tenancy ────────────────────────────────────────────────

describe("getInsightsData (multi-tenancy)", () => {
  it("filtra o mês por accountId e retorna vazio se não pertencer à account", async () => {
    prismaMock.month.findFirst.mockResolvedValue(null);

    const result = await getInsightsData("acc-test-1", "month-de-outra-account", {
      isCurrentMonth: true,
    });

    expect(result.currentCategories).toEqual([]);
    expect(result.budgetsCurrent).toEqual([]);
    expect(result.adherenceHistory).toEqual([]);
    expect(prismaMock.month.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "month-de-outra-account",
          accountId: "acc-test-1",
        }),
      }),
    );
  });
});

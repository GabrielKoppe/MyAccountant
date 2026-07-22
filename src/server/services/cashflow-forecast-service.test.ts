import { describe, expect, it } from "vitest";

import { composeForecast, type ForecastInput } from "./cashflow-forecast-service";

const base: ForecastInput = {
  startingBalanceCents: 100000n,
  startingBalanceIsOverride: false,
  horizonMonths: 3,
  scenarioDefault: "realistic",
  optimisticPct: 10,
  conservativePct: 20,
  variableWindow: 6,
  closedMonthCount: 6,
  estimatedNetBaseCents: 0n,
  recurringSectionTotals: {},
  installmentsByMonth: {},
  sections: [
    { id: "in", countType: "add" },
    { id: "out", countType: "subtract" },
  ],
  anchorMonth: { year: 2026, month: 8 },
};

describe("composeForecast", () => {
  it("sem insumos -> saldo constante em N pontos + ancora", () => {
    const r = composeForecast(base);
    expect(r.points).toHaveLength(4); // 1 ancora + 3
    expect(r.points.every((p) => p.realisticBalanceCents === 100000n)).toBe(true);
    expect(r.runwayYearMonth).toBeNull();
  });

  it("fator de cenario incide so no estimado; conhecido fica fixo", () => {
    const r = composeForecast({
      ...base,
      recurringSectionTotals: { in: 500000n, out: 300000n }, // conhecido +2000/mes
      estimatedNetBaseCents: -100000n, // estimado -1000/mes
    });
    const m1 = r.points[1];
    expect(m1.realisticBalanceCents).toBe(200000n); // 1000 + (2000-1000)
    expect(m1.optimisticBalanceCents).toBe(210000n); // estimado -900 -> +1100
    expect(m1.conservativeBalanceCents).toBe(180000n); // estimado -1200 -> +800
    expect(m1.recurringInflowCents).toBe(500000n);
    expect(m1.recurringOutflowCents).toBe(300000n);
  });

  it("detecta runway e vale quando saldo cai abaixo de zero", () => {
    const r = composeForecast({
      ...base,
      startingBalanceCents: 150000n,
      recurringSectionTotals: { out: 100000n }, // -1000/mes
    });
    // saldos: 1500 -> 500 -> -500 -> -1500
    expect(r.runwayYearMonth).toBe("2026-10");
    expect(r.troughBalanceCents).toBe(-150000n);
    expect(r.troughYearMonth).toBe("2026-11");
  });

  it("marca hasLowData quando janela efetiva < alvo", () => {
    expect(composeForecast({ ...base, closedMonthCount: 2 }).hasLowData).toBe(true);
    expect(composeForecast({ ...base, closedMonthCount: 6 }).hasLowData).toBe(false);
  });

  it("parcelas: subtract soma, add abate; decomposição reconcilia", () => {
    const r = composeForecast({
      ...base,
      installmentsByMonth: { "2026-09": { out: 50000n, in: 20000n } }, // out=subtract, in=add
    });
    const sep = r.points.find((p) => p.yearMonth === "2026-09")!;
    expect(sep.installmentsOutflowCents).toBe(30000n); // 50000 (subtract) − 20000 (add)
    expect(sep.monthResultCents).toBe(-30000n); // known = +20000 − 50000
    // invariante da decomposição:
    expect(
      sep.recurringInflowCents -
        sep.recurringOutflowCents -
        sep.installmentsOutflowCents +
        sep.estimatedCents,
    ).toBe(sep.monthResultCents);
  });

  it("neutral conta como inflow; ignore não afeta", () => {
    const r = composeForecast({
      ...base,
      sections: [
        { id: "in", countType: "add" },
        { id: "out", countType: "subtract" },
        { id: "inv", countType: "neutral" },
        { id: "skip", countType: "ignore" },
      ],
      recurringSectionTotals: { inv: 100000n, skip: 999999n },
    });
    const m1 = r.points[1];
    expect(m1.recurringInflowCents).toBe(100000n); // neutral em inflow; ignore fora
    expect(m1.monthResultCents).toBe(100000n);
  });

  it("vale aponta para mês projetado, nunca para a âncora", () => {
    const r = composeForecast({
      ...base,
      startingBalanceCents: 100000n,
      recurringSectionTotals: { in: 50000n }, // +500/mês, saldo sempre sobe
    });
    expect(r.troughYearMonth).toBe("2026-09"); // 1º projetado, não a âncora "2026-08"
    expect(r.troughBalanceCents).toBe(150000n);
  });

  it("estimado líquido positivo mantém ordem otimista >= realista >= conservador", () => {
    const r = composeForecast({ ...base, estimatedNetBaseCents: 50000n });
    const m1 = r.points[1];
    expect(m1.optimisticBalanceCents >= m1.realisticBalanceCents).toBe(true);
    expect(m1.realisticBalanceCents >= m1.conservativeBalanceCents).toBe(true);
  });
});

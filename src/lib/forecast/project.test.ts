import { describe, expect, it } from "vitest";

import {
  composeForecast,
  deriveForecastInput,
  type ForecastBasis,
  type ForecastInput,
  type ForecastParams,
} from "./project";

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

  it("fatores 0% -> os três cenários coincidem", () => {
    const r = composeForecast({
      ...base,
      optimisticPct: 0,
      conservativePct: 0,
      estimatedNetBaseCents: -100000n,
    });
    for (const p of r.points) {
      expect(p.optimisticBalanceCents).toBe(p.realisticBalanceCents);
      expect(p.conservativeBalanceCents).toBe(p.realisticBalanceCents);
    }
  });

  it("horizonte 1 -> âncora + 1 ponto projetado", () => {
    const r = composeForecast({ ...base, horizonMonths: 1 });
    expect(r.points).toHaveLength(2);
    expect(r.points[0].isProjected).toBe(false);
    expect(r.points[1].yearMonth).toBe("2026-09");
  });
});

// ─── deriveForecastInput (spec 71 §7.2 — parâmetros aplicados sobre o basis) ──

const basis: ForecastBasis = {
  sections: [
    { id: "in", countType: "add" },
    { id: "out", countType: "subtract" },
  ],
  closedMonths: [
    { yearMonth: "2026-05", netCents: 100000n },
    { yearMonth: "2026-06", netCents: 200000n },
    { yearMonth: "2026-07", netCents: 300000n },
    { yearMonth: "2026-08", netCents: 400000n },
  ],
  uncommittedMonths: [
    { yearMonth: "2026-05", netCents: -100000n },
    { yearMonth: "2026-06", netCents: -200000n },
    { yearMonth: "2026-07", netCents: -300000n },
    { yearMonth: "2026-08", netCents: -400000n },
  ],
  recurringSectionTotals: { out: 50000n },
  installmentsByMonth: { "2026-09": { out: 10000n } },
  anchorMonth: { year: 2026, month: 8 },
};

const params: ForecastParams = {
  horizonMonths: 3,
  scenarioDefault: "realistic",
  optimisticPct: 10,
  conservativePct: 20,
  variableWindow: 2,
  startBalanceOverrideCents: null,
};

describe("deriveForecastInput", () => {
  it("média usa só os N meses mais recentes da janela", () => {
    const input = deriveForecastInput(basis, params);
    // janela 2 -> (−3000 + −4000) / 2 = −3500
    expect(input.estimatedNetBaseCents).toBe(-350000n);
    expect(input.closedMonthCount).toBe(4);
  });

  it("janela maior que o histórico cai para os meses disponíveis", () => {
    const input = deriveForecastInput(basis, { ...params, variableWindow: 12 });
    // effectiveWindow = 4 -> (−1000 −2000 −3000 −4000) / 4 = −2500
    expect(input.estimatedNetBaseCents).toBe(-250000n);
    // hasLowData é decidido por composeForecast a partir de variableWindow vs closedMonthCount
    expect(composeForecast(input).hasLowData).toBe(true);
  });

  it("divide a soma UMA vez (não média de médias)", () => {
    const odd: ForecastBasis = {
      ...basis,
      uncommittedMonths: [
        { yearMonth: "2026-07", netCents: -10000n },
        { yearMonth: "2026-08", netCents: -10001n },
      ],
      closedMonths: basis.closedMonths.slice(-2),
    };
    // Σ = −20001 -> /2 = −10000,5 -> Math.round = −10000 (semântica preservada da spec 48)
    expect(deriveForecastInput(odd, params).estimatedNetBaseCents).toBe(-10000n);
  });

  it("conta sem mês fechado: estimado e saldo de partida em zero", () => {
    const empty: ForecastBasis = { ...basis, closedMonths: [], uncommittedMonths: [] };
    const input = deriveForecastInput(empty, params);
    expect(input.closedMonthCount).toBe(0);
    expect(input.estimatedNetBaseCents).toBe(0n);
    expect(input.startingBalanceCents).toBe(0n);
    expect(input.startingBalanceIsOverride).toBe(false);
  });

  it("saldo de partida sem override soma os nets de todos os meses fechados", () => {
    expect(deriveForecastInput(basis, params).startingBalanceCents).toBe(1000000n);
  });

  it("override manda no saldo de partida e marca a flag", () => {
    const input = deriveForecastInput(basis, { ...params, startBalanceOverrideCents: 4218000n });
    expect(input.startingBalanceCents).toBe(4218000n);
    expect(input.startingBalanceIsOverride).toBe(true);
  });

  it("override de 0 é valor informado, não ausência de valor", () => {
    const input = deriveForecastInput(basis, { ...params, startBalanceOverrideCents: 0n });
    expect(input.startingBalanceCents).toBe(0n);
    expect(input.startingBalanceIsOverride).toBe(true);
  });

  it("repassa seções, recorrentes, parcelas e âncora sem alterar", () => {
    const input = deriveForecastInput(basis, params);
    expect(input.sections).toEqual(basis.sections);
    expect(input.recurringSectionTotals).toEqual(basis.recurringSectionTotals);
    expect(input.installmentsByMonth).toEqual(basis.installmentsByMonth);
    expect(input.anchorMonth).toEqual(basis.anchorMonth);
  });
});

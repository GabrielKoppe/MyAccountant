import { describe, expect, it } from "vitest";

import {
  computeProgress,
  computePace,
  buildGlidePath,
  computeMemberSplit,
  computeGoalsOverview,
  addFiscalMonths,
  maxFiscalMonth,
  minFiscalMonth,
  MAX_HORIZON_MONTHS,
  type GoalWithContributions,
} from "./goal-service";

// ─── computeProgress (§4.1) ─────────────────────────────────────────────

describe("computeProgress", () => {
  it("soma contribuições e calcula remaining/percent", () => {
    const result = computeProgress(100000n, [
      { amountCents: 30000n, contributedOn: new Date("2026-01-01") },
      { amountCents: 20000n, contributedOn: new Date("2026-02-01") },
    ]);
    expect(result).toEqual({
      progressCents: 50000n,
      remainingCents: 50000n,
      percent: 50,
      isAchieved: false,
    });
  });

  it("isAchieved=true e remainingCents=0 quando progresso == alvo (limite exato)", () => {
    const result = computeProgress(50000n, [
      { amountCents: 50000n, contributedOn: new Date("2026-01-01") },
    ]);
    expect(result.isAchieved).toBe(true);
    expect(result.remainingCents).toBe(0n);
    expect(result.percent).toBe(100);
  });

  it("over-aporte: percent real > 100, remainingCents satura em 0 (DD-05)", () => {
    const result = computeProgress(50000n, [
      { amountCents: 75000n, contributedOn: new Date("2026-01-01") },
    ]);
    expect(result.percent).toBe(150);
    expect(result.remainingCents).toBe(0n);
    expect(result.isAchieved).toBe(true);
  });

  it("sem contribuições: progresso zero, remaining == alvo", () => {
    const result = computeProgress(100000n, []);
    expect(result).toEqual({
      progressCents: 0n,
      remainingCents: 100000n,
      percent: 0,
      isAchieved: false,
    });
  });
});

// ─── computePace (§4.2 / §4.3) ──────────────────────────────────────────

describe("computePace", () => {
  const currentFiscal = { year: 2026, month: 7 };
  const monthStartDay = 1;

  it("no_contribution sem deadline: requiredMonthlyCents e projectedMonth ambos null", () => {
    const result = computePace({
      targetCents: 100000n,
      deadline: null,
      contributions: [],
      currentFiscal,
      monthStartDay,
    });
    expect(result).toEqual({
      pace: "no_contribution",
      requiredMonthlyCents: null,
      projectedMonth: null,
    });
  });

  it("no_contribution com deadline: requiredMonthlyCents ainda é calculado (ritmo pra começar)", () => {
    const result = computePace({
      targetCents: 100000n,
      deadline: new Date("2026-12-01"), // 5 meses fiscais à frente de jul
      contributions: [],
      currentFiscal,
      monthStartDay,
    });
    expect(result.pace).toBe("no_contribution");
    expect(result.projectedMonth).toBeNull();
    expect(result.requiredMonthlyCents).toBe(20000n); // round(100000/5)
  });

  it("achieved quando progresso >= alvo, mesmo com deadline vencido", () => {
    const result = computePace({
      targetCents: 50000n,
      deadline: new Date("2026-01-01"), // já passou
      contributions: [{ amountCents: 60000n, contributedOn: new Date("2026-06-01") }],
      currentFiscal,
      monthStartDay,
    });
    expect(result.pace).toBe("achieved");
  });

  it("behind quando o ritmo atual não bate o prazo", () => {
    const result = computePace({
      targetCents: 120000n,
      deadline: new Date("2026-10-01"), // deadlineFiscal {2026,10} — 3 meses à frente
      contributions: [{ amountCents: 10000n, contributedOn: new Date("2026-07-15") }],
      currentFiscal,
      monthStartDay,
    });
    // elapsed=1 -> avgMonthly=10000n; remaining=110000n; monthsToDeadline=3 -> required=round(110000/3)=36667n
    // monthsToComplete=ceil(110000/10000)=11 -> projectedMonth = jun/2027 > deadline (out/2026) -> behind
    expect(result.pace).toBe("behind");
    expect(result.requiredMonthlyCents).toBe(36667n);
    expect(result.projectedMonth).toEqual({ year: 2027, month: 6 });
  });

  it("on_track quando o ritmo bate o necessário sem superar 5% de folga", () => {
    const result = computePace({
      targetCents: 90000n,
      deadline: new Date("2026-09-01"), // deadlineFiscal {2026,9} — 2 meses à frente
      contributions: [{ amountCents: 30000n, contributedOn: new Date("2026-07-15") }],
      currentFiscal,
      monthStartDay,
    });
    // avgMonthly=30000n; remaining=60000n; monthsToDeadline=2 -> required=round(60000/2)=30000n
    // avgMonthly == required (não > 1.05x) -> on_track; monthsToComplete=2 -> projectedMonth == deadline
    expect(result.pace).toBe("on_track");
    expect(result.requiredMonthlyCents).toBe(30000n);
    expect(result.projectedMonth).toEqual({ year: 2026, month: 9 });
  });

  it("ahead quando o ritmo supera o necessário em mais de 5%", () => {
    const result = computePace({
      targetCents: 90000n,
      deadline: new Date("2026-09-01"),
      contributions: [{ amountCents: 45000n, contributedOn: new Date("2026-07-15") }],
      currentFiscal,
      monthStartDay,
    });
    // avgMonthly=45000n; remaining=45000n; monthsToDeadline=2 -> required=round(45000/2)=22500n
    // 45000 > 22500*1.05=23625 -> ahead
    expect(result.pace).toBe("ahead");
    expect(result.requiredMonthlyCents).toBe(22500n);
  });

  it("on_track quando não há deadline, mesmo havendo aportes (não há prazo pra ficar atrás/à frente)", () => {
    const result = computePace({
      targetCents: 100000n,
      deadline: null,
      contributions: [{ amountCents: 1000n, contributedOn: new Date("2026-07-01") }],
      currentFiscal,
      monthStartDay,
    });
    expect(result.pace).toBe("on_track");
    expect(result.requiredMonthlyCents).toBeNull();
    expect(result.projectedMonth).not.toBeNull(); // projeção existe independente de haver deadline
  });

  it("monthsToDeadline mínimo de 1 quando o deadline cai no mês fiscal corrente", () => {
    const result = computePace({
      targetCents: 100000n,
      deadline: new Date("2026-07-20"), // mesmo mês fiscal do currentFiscal
      contributions: [],
      currentFiscal,
      monthStartDay,
    });
    expect(result.requiredMonthlyCents).toBe(100000n); // tudo neste mês (max(1, 0))
  });

  // B1 (fix wave, blocker): meta grande + aporte médio minúsculo disparava
  // monthsToComplete pra ~200k meses (ceil(remaining/avgMonthly) sem teto) —
  // buildGlidePath serializaria ~200k pontos e travaria browser/server.
  it("projectedMonth clampado a MAX_HORIZON_MONTHS quando o aporte médio é minúsculo frente a um alvo grande (B1)", () => {
    const result = computePace({
      targetCents: 100_000_000_00n, // R$ 100 milhões
      deadline: null,
      contributions: [{ amountCents: 1n, contributedOn: new Date("2026-07-01") }], // 1 centavo
      currentFiscal,
      monthStartDay,
    });
    // Sem clamp: monthsToComplete = ceil((100_000_000_00 - 1) / 1) ≈ 10 bilhões de meses.
    // Com clamp: nunca passa de currentFiscal + MAX_HORIZON_MONTHS.
    expect(result.projectedMonth).toEqual(addFiscalMonths(currentFiscal, MAX_HORIZON_MONTHS));
  });
});

// ─── buildGlidePath (§4.4) ──────────────────────────────────────────────

describe("buildGlidePath", () => {
  it("acumula contribuições em carry-forward mensal (cumulativo, nunca decresce)", () => {
    const points = buildGlidePath({
      targetCents: 100000n,
      deadline: null,
      startMonth: { year: 2026, month: 1 },
      endMonth: { year: 2026, month: 3 },
      contributions: [
        { amountCents: 10000n, contributedOn: new Date("2026-01-15") },
        { amountCents: 20000n, contributedOn: new Date("2026-03-05") },
      ],
      monthStartDay: 1,
    });

    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({
      year: 2026,
      month: 1,
      cumulativeCents: 10000n,
      idealCents: null,
    });
    expect(points[1]).toMatchObject({
      year: 2026,
      month: 2,
      cumulativeCents: 10000n,
      idealCents: null,
    }); // sem novo aporte em fev
    expect(points[2]).toMatchObject({
      year: 2026,
      month: 3,
      cumulativeCents: 30000n,
      idealCents: null,
    });
  });

  it("linha ideal só aparece com deadline (linear de 0 ao alvo)", () => {
    const points = buildGlidePath({
      targetCents: 120000n,
      deadline: new Date("2026-04-01"), // deadlineFiscal {2026,4} — 3 meses de jan a abr
      startMonth: { year: 2026, month: 1 },
      endMonth: { year: 2026, month: 4 },
      contributions: [],
      monthStartDay: 1,
    });

    expect(points[0].idealCents).toBe(0n); // início
    expect(points[1].idealCents).toBe(40000n); // 1/3 do caminho
    expect(points[2].idealCents).toBe(80000n); // 2/3
    expect(points[3].idealCents).toBe(120000n); // no deadline, ideal == alvo
  });

  it("meta sem deadline nunca expõe idealCents (todos os pontos null)", () => {
    const points = buildGlidePath({
      targetCents: 50000n,
      deadline: null,
      startMonth: { year: 2026, month: 1 },
      endMonth: { year: 2026, month: 2 },
      contributions: [],
      monthStartDay: 1,
    });
    expect(points.every((p) => p.idealCents === null)).toBe(true);
  });

  it("deadline no mesmo mês do início (ou antes): ideal já nasce igual ao alvo", () => {
    const points = buildGlidePath({
      targetCents: 50000n,
      deadline: new Date("2026-01-15"), // mesmo mês fiscal do startMonth
      startMonth: { year: 2026, month: 1 },
      endMonth: { year: 2026, month: 2 },
      contributions: [],
      monthStartDay: 1,
    });
    expect(points[0].idealCents).toBe(50000n);
    expect(points[1].idealCents).toBe(50000n);
  });

  it("targetCents é constante em todos os pontos (linha de referência)", () => {
    const points = buildGlidePath({
      targetCents: 77700n,
      deadline: null,
      startMonth: { year: 2026, month: 1 },
      endMonth: { year: 2026, month: 2 },
      contributions: [],
      monthStartDay: 1,
    });
    expect(points.every((p) => p.targetCents === 77700n)).toBe(true);
  });

  // Refinamento Fase 9 (§4.4): resolveGlidePathRange (queries/goals.ts) estende o
  // endMonth até o mês fiscal corrente quando o deadline já passou — buildGlidePath
  // precisa continuar acumulando a linha real além do prazo, mas parar a linha ideal
  // exatamente nele (não flatlinar no alvo indefinidamente).
  it("prazo vencido: aporte posterior ao deadline aparece no acúmulo real; ideal para no deadline", () => {
    const points = buildGlidePath({
      targetCents: 100000n,
      deadline: new Date("2026-03-15"), // deadlineFiscal {2026,3} — 2 meses de jan a mar
      startMonth: { year: 2026, month: 1 },
      endMonth: { year: 2026, month: 5 }, // estendido (deadline vencido, "hoje" = maio)
      contributions: [
        { amountCents: 40000n, contributedOn: new Date("2026-02-10") }, // antes do deadline
        { amountCents: 60000n, contributedOn: new Date("2026-04-20") }, // DEPOIS do deadline
      ],
      monthStartDay: 1,
    });

    expect(points).toHaveLength(5); // jan, fev, mar, abr, mai

    // Acúmulo real: carry-forward normal, inclusive do aporte lançado após o prazo.
    expect(points.map((p) => p.cumulativeCents)).toEqual([0n, 40000n, 40000n, 100000n, 100000n]);

    // Ideal: linear 0→alvo até o deadline (mar, i=2)...
    expect(points[0].idealCents).toBe(0n); // jan
    expect(points[1].idealCents).toBe(50000n); // fev — metade do caminho
    expect(points[2].idealCents).toBe(100000n); // mar — no deadline, ideal == alvo
    // ...e some (null) depois dele — não flatlina no alvo indefinidamente.
    expect(points[3].idealCents).toBeNull(); // abr — já vencido
    expect(points[4].idealCents).toBeNull(); // mai — já vencido

    // targetCents continua constante em toda a série (linha de referência).
    expect(points.every((p) => p.targetCents === 100000n)).toBe(true);
  });

  // B1 (fix wave, blocker): buildGlidePath em si não clampa (quem clampa é o
  // caller, via minFiscalMonth em resolveGlidePathRange) — este teste prova que,
  // com um range JÁ clampado a MAX_HORIZON_MONTHS, a série nunca ultrapassa
  // ~121 pontos, mesmo partindo de um endMonth "natural" muito mais distante.
  it("com range clampado a MAX_HORIZON_MONTHS, nunca gera mais que MAX_HORIZON_MONTHS+1 pontos (B1)", () => {
    const startMonth = { year: 2026, month: 1 };
    const clampedEndMonth = addFiscalMonths(startMonth, MAX_HORIZON_MONTHS);

    const points = buildGlidePath({
      targetCents: 100_000_000_00n,
      deadline: null,
      startMonth,
      endMonth: clampedEndMonth,
      contributions: [{ amountCents: 1n, contributedOn: new Date("2026-01-15") }],
      monthStartDay: 1,
    });

    expect(points.length).toBe(MAX_HORIZON_MONTHS + 1); // 0..120 inclusive
  });
});

// ─── maxFiscalMonth (helper de resolveGlidePathRange, queries/goals.ts) ────

describe("maxFiscalMonth", () => {
  it("retorna o mês fiscal mais recente entre os dois", () => {
    expect(maxFiscalMonth({ year: 2026, month: 3 }, { year: 2026, month: 7 })).toEqual({
      year: 2026,
      month: 7,
    });
    expect(maxFiscalMonth({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("empate retorna o primeiro argumento", () => {
    const a = { year: 2026, month: 5 };
    expect(maxFiscalMonth(a, { year: 2026, month: 5 })).toEqual(a);
  });
});

// ─── minFiscalMonth (helper de resolveGlidePathRange, B1) ──────────────────

describe("minFiscalMonth", () => {
  it("retorna o mês fiscal mais antigo entre os dois", () => {
    expect(minFiscalMonth({ year: 2026, month: 3 }, { year: 2026, month: 7 })).toEqual({
      year: 2026,
      month: 3,
    });
    expect(minFiscalMonth({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toEqual({
      year: 2026,
      month: 12,
    });
  });

  it("empate retorna o primeiro argumento", () => {
    const a = { year: 2026, month: 5 };
    expect(minFiscalMonth(a, { year: 2026, month: 5 })).toEqual(a);
  });

  it("clampa um fim distante ao teto MAX_HORIZON_MONTHS a partir do início (uso real em resolveGlidePathRange)", () => {
    const startMonth = { year: 2026, month: 1 };
    const farEndMonth = addFiscalMonths(startMonth, 5000); // deadline hipotético bem distante
    const clamped = minFiscalMonth(farEndMonth, addFiscalMonths(startMonth, MAX_HORIZON_MONTHS));
    expect(clamped).toEqual(addFiscalMonths(startMonth, MAX_HORIZON_MONTHS));
  });
});

// ─── computeMemberSplit (§4.5) ──────────────────────────────────────────

describe("computeMemberSplit", () => {
  it("agrupa contribuições por byUserId (soma) com nome e percentual sobre o total", () => {
    const result = computeMemberSplit(
      [
        { byUserId: "u1", amountCents: 30000n },
        { byUserId: "u2", amountCents: 40000n },
        { byUserId: "u1", amountCents: 30000n },
      ],
      new Map([
        ["u1", "Gabriel"],
        ["u2", "Ana"],
      ]),
    );

    expect(result).toEqual([
      { userId: "u1", userName: "Gabriel", totalCents: 60000n, percent: 60 },
      { userId: "u2", userName: "Ana", totalCents: 40000n, percent: 40 },
    ]);
  });

  it("usa o próprio userId como fallback quando o nome não está no mapa", () => {
    const result = computeMemberSplit(
      [{ byUserId: "u-desconhecido", amountCents: 1000n }],
      new Map(),
    );
    expect(result[0].userName).toBe("u-desconhecido");
  });

  it("retorna lista vazia sem contribuições", () => {
    expect(computeMemberSplit([], new Map())).toEqual([]);
  });
});

// ─── computeGoalsOverview (§4.6) ────────────────────────────────────────

describe("computeGoalsOverview", () => {
  const currentFiscal = { year: 2026, month: 7 };
  const monthStartDay = 1;

  it("soma progresso/alvo só das metas ativas; arquivada fica fora do agregado", () => {
    const goals: GoalWithContributions[] = [
      {
        id: "g-ativa",
        targetCents: 100000n,
        deadline: null,
        archivedAt: null,
        contributions: [{ amountCents: 30000n, contributedOn: new Date("2026-07-10") }],
      },
      {
        id: "g-arquivada",
        targetCents: 999999n,
        deadline: null,
        archivedAt: new Date("2026-06-01"),
        contributions: [{ amountCents: 500000n, contributedOn: new Date("2026-07-10") }],
      },
    ];

    const result = computeGoalsOverview(goals, currentFiscal, monthStartDay);

    expect(result.totalSavedCents).toBe(30000n);
    expect(result.totalTargetCents).toBe(100000n);
    expect(result.contributedThisMonthCents).toBe(30000n); // meta arquivada não entra
  });

  it("contributedThisMonthCents soma só contribuições do mês fiscal corrente", () => {
    const goals: GoalWithContributions[] = [
      {
        id: "g1",
        targetCents: 100000n,
        deadline: null,
        archivedAt: null,
        contributions: [
          { amountCents: 10000n, contributedOn: new Date("2026-07-05") }, // este mês
          { amountCents: 20000n, contributedOn: new Date("2026-06-05") }, // mês anterior
        ],
      },
    ];

    const result = computeGoalsOverview(goals, currentFiscal, monthStartDay);

    expect(result.contributedThisMonthCents).toBe(10000n);
  });

  it("nextDeadlineGoal aponta para a meta ativa não-atingida com deadline mais próximo", () => {
    const goals: GoalWithContributions[] = [
      {
        id: "longe",
        targetCents: 100000n,
        deadline: new Date("2027-01-01"),
        archivedAt: null,
        contributions: [],
      },
      {
        id: "perto",
        targetCents: 100000n,
        deadline: new Date("2026-08-01"),
        archivedAt: null,
        contributions: [],
      },
      {
        id: "atingida",
        targetCents: 1000n,
        deadline: new Date("2026-07-15"),
        archivedAt: null,
        contributions: [{ amountCents: 1000n, contributedOn: new Date("2026-07-01") }],
      },
    ];

    const result = computeGoalsOverview(goals, currentFiscal, monthStartDay);

    expect(result.nextDeadlineGoal?.id).toBe("perto");
  });

  it("counts: achieved/behind mapeiam 1:1, ahead conta em onTrack, no_contribution tem balde próprio (4 baldes reconciliam com o total ativo)", () => {
    const goals: GoalWithContributions[] = [
      {
        id: "g-achieved",
        targetCents: 1000n,
        deadline: null,
        archivedAt: null,
        contributions: [{ amountCents: 1000n, contributedOn: new Date("2026-07-01") }],
      },
      {
        id: "g-behind",
        targetCents: 1000000n,
        deadline: new Date("2026-08-01"),
        archivedAt: null,
        contributions: [{ amountCents: 1000n, contributedOn: new Date("2026-07-01") }],
      },
      {
        // pace "ahead" explícito — mesmos parâmetros do teste "ahead" de computePace
        // (ritmo supera o necessário em mais de 5%). Deve contar em onTrack.
        id: "g-ahead",
        targetCents: 90000n,
        deadline: new Date("2026-09-01"),
        archivedAt: null,
        contributions: [{ amountCents: 45000n, contributedOn: new Date("2026-07-15") }],
      },
      {
        // pace "no_contribution" (meta ainda não iniciada) — conta no balde próprio.
        id: "g-sem-aporte",
        targetCents: 50000n,
        deadline: null,
        archivedAt: null,
        contributions: [],
      },
    ];

    const result = computeGoalsOverview(goals, currentFiscal, monthStartDay);

    expect(result.counts).toEqual({ onTrack: 1, behind: 1, achieved: 1, noContribution: 1 });
  });
});

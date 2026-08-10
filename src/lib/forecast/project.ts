// ─── Spec 48 / Spec 71 §7.2 — matemática da projeção de fluxo de caixa ──────
//
// Módulo PURO e client-safe (sem Prisma, sem `server-only`): é a MESMA função
// que a página `/forecast` usa no servidor e que o preview ao vivo de
// Configurações → Projeção usa no client. Nunca aproximar o preview com um
// cálculo paralelo (anti-padrão explícito da spec 71 §7.2).
//
// Duas camadas:
//   1. `deriveForecastInput(basis, params)` — aplica os PARÂMETROS sobre o
//      material bruto da conta (`ForecastBasis`, independente de parâmetro).
//   2. `composeForecast(input)` — projeta saldo mês a mês nos 3 cenários.
//
// Assim o servidor busca o `basis` uma única vez e o client recalcula a cada
// movimento de slider sem round-trip.

import type { SectionCountType } from "@prisma/client";

import { formatMonthLabel } from "@/lib/dates";
import { calculateMonthTotal } from "@/lib/month-total";
import type { Scenario } from "@/lib/schemas/forecast";

/** Teto do horizonte configurável — dimensiona o range de parcelas do `basis`. */
export const MAX_HORIZON_MONTHS = 24;
/** Teto da janela de estimativa — dimensiona quantos meses fechados o `basis` carrega. */
export const MAX_ESTIMATION_WINDOW = 12;

type SectionRef = { id: string; countType: SectionCountType };

/** Um mês fechado e seu resultado líquido (já netado por `countType`). */
export type MonthlyAggregate = { yearMonth: string; netCents: bigint };

/**
 * Material da conta que NÃO depende de nenhum parâmetro de projeção — buscado
 * uma vez por request (`getForecastBasis`) e reaproveitado em todo recálculo.
 */
export type ForecastBasis = {
  sections: SectionRef[];
  /** Meses fechados em ordem crescente; `netCents` = total do mês (tabelas que contam no mês). */
  closedMonths: MonthlyAggregate[];
  /**
   * Últimos ≤ `MAX_ESTIMATION_WINDOW` meses fechados, em ordem crescente, com o
   * resultado líquido NÃO-COMPROMETIDO (exclui recorrentes, parcelas e gastos
   * únicos) — é a base da média por janela.
   */
  uncommittedMonths: MonthlyAggregate[];
  /** sectionId → Σ recorrentes mensais (igual em todo mês do horizonte). */
  recurringSectionTotals: Record<string, bigint>;
  /** "YYYY-MM" → sectionId → Σ parcelas previstas, até `MAX_HORIZON_MONTHS`. */
  installmentsByMonth: Record<string, Record<string, bigint>>;
  /** Último mês fechado — ponto-âncora do gráfico; a projeção começa no mês SEGUINTE. */
  anchorMonth: { year: number; month: number };
};

/** Os parâmetros configuráveis da projeção (spec 71 §2.1). */
export type ForecastParams = {
  horizonMonths: number;
  scenarioDefault: Scenario;
  optimisticPct: number;
  conservativePct: number;
  variableWindow: number;
  /** Saldo de partida informado à mão; `null` = calcular dos meses fechados. */
  startBalanceOverrideCents: bigint | null;
};

export type ForecastInput = {
  startingBalanceCents: bigint;
  startingBalanceIsOverride: boolean;
  horizonMonths: number;
  scenarioDefault: Scenario;
  optimisticPct: number;
  conservativePct: number;
  variableWindow: number;
  closedMonthCount: number;
  // média mensal líquida do bloco estimado; sinal via countType, tipicamente negativo
  estimatedNetBaseCents: bigint;
  // sectionId → Σ recorrentes mensais
  recurringSectionTotals: Record<string, bigint>;
  // chave "YYYY-MM"
  installmentsByMonth: Record<string, Record<string, bigint>>;
  sections: SectionRef[];
  // último mês fechado (ponto-âncora, isProjected:false); a projeção começa no mês SEGUINTE (= mês fiscal corrente)
  anchorMonth: { year: number; month: number };
};

export type ForecastPointDomain = {
  yearMonth: string;
  label: string;
  isProjected: boolean;
  realisticBalanceCents: bigint;
  optimisticBalanceCents: bigint;
  conservativeBalanceCents: bigint;
  recurringInflowCents: bigint;
  recurringOutflowCents: bigint;
  installmentsOutflowCents: bigint;
  estimatedCents: bigint;
  monthResultCents: bigint;
};

export type ForecastResult = {
  startingBalanceCents: bigint;
  startingBalanceIsOverride: boolean;
  horizonMonths: number;
  scenarioDefault: Scenario;
  points: ForecastPointDomain[];
  runwayYearMonth: string | null;
  troughYearMonth: string;
  troughBalanceCents: bigint;
  variableWindow: number;
  effectiveWindow: number;
  hasLowData: boolean;
  factors: { optimisticPct: number; conservativePct: number };
};

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const nextMonth = (y: number, m: number) =>
  m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };

/**
 * Aplica os parâmetros sobre o material da conta. É aqui que a **janela** vira
 * média, a **origem do saldo** vira saldo de partida e o **horizonte** delimita
 * o que será iterado — tudo o que antes era derivado dentro da query.
 */
export function deriveForecastInput(basis: ForecastBasis, params: ForecastParams): ForecastInput {
  const closedMonthCount = basis.closedMonths.length;
  const effectiveWindow = Math.min(params.variableWindow, closedMonthCount);

  // Média sobre a janela: soma os nets dos N meses mais recentes e divide UMA
  // vez (nunca bigint/bigint, que truncaria — skill money-handling).
  let estimatedNetBaseCents = 0n;
  if (effectiveWindow > 0) {
    const window = basis.uncommittedMonths.slice(-effectiveWindow);
    const netOverWindow = window.reduce((acc, m) => acc + m.netCents, 0n);
    estimatedNetBaseCents = BigInt(Math.round(Number(netOverWindow) / effectiveWindow));
  }

  const startingBalanceIsOverride = params.startBalanceOverrideCents !== null;
  const startingBalanceCents = startingBalanceIsOverride
    ? params.startBalanceOverrideCents!
    : basis.closedMonths.reduce((acc, m) => acc + m.netCents, 0n);

  return {
    startingBalanceCents,
    startingBalanceIsOverride,
    horizonMonths: params.horizonMonths,
    scenarioDefault: params.scenarioDefault,
    optimisticPct: params.optimisticPct,
    conservativePct: params.conservativePct,
    variableWindow: params.variableWindow,
    closedMonthCount,
    estimatedNetBaseCents,
    recurringSectionTotals: basis.recurringSectionTotals,
    installmentsByMonth: basis.installmentsByMonth,
    sections: basis.sections,
    anchorMonth: basis.anchorMonth,
  };
}

/** Projeta o saldo mês a mês (âncora + horizonte) nos 3 cenários, decompondo cada ponto em recorrente/parcelas/estimado. */
export function composeForecast(input: ForecastInput): ForecastResult {
  const effectiveWindow = Math.min(input.variableWindow, input.closedMonthCount);
  const hasLowData = effectiveWindow < input.variableWindow;

  // Cenários aplicados como fração do MÓDULO do estimado, sempre na direção favorável
  // (otimista) ou desfavorável (conservador) — sign-robust. Multiplicar a base por um fator
  // (1 ± pct/100) só ordena corretamente (otimista ≥ realista ≥ conservador) quando a base é
  // negativa (saída típica); se a base é líquida POSITIVA (entrada não-comprometida > saída
  // não-comprometida), essa multiplicação inverte a ordem e a banda do gráfico fica invertida.
  // Constante ao longo do horizonte (base é mensal) — computado uma única vez, fora do loop.
  const base = input.estimatedNetBaseCents;
  const absBase = base < 0n ? -base : base;
  const optDelta = BigInt(Math.round((Number(absBase) * input.optimisticPct) / 100));
  const consDelta = BigInt(Math.round((Number(absBase) * input.conservativePct) / 100));
  const estR = base; // realista
  const estO = base + optDelta; // otimista: sempre saldo MAIOR (mais favorável)
  const estC = base - consDelta; // conservador: sempre saldo MENOR (menos favorável)

  const ctById = new Map(input.sections.map((s) => [s.id, s.countType]));
  let recurringInflow = 0n,
    recurringOutflow = 0n;
  for (const [id, total] of Object.entries(input.recurringSectionTotals)) {
    const ct = ctById.get(id);
    // neutral tratado como inflow (preserva o sinal no total; coerente com calculateMonthTotal)
    if (ct === "add" || ct === "neutral") recurringInflow += total;
    else if (ct === "subtract") recurringOutflow += total;
  }

  const points: ForecastPointDomain[] = [];
  // O ponto-âncora (último mês fechado, isProjected: false) usa a própria data de
  // `anchorMonth`; a projeção em si começa no mês seguinte (ver nota na query
  // sobre o alinhamento de calendário exigido pelos testes de runway/trough).
  const anchor = input.anchorMonth;
  points.push({
    yearMonth: ym(anchor.year, anchor.month),
    label: formatMonthLabel(anchor.year, anchor.month),
    isProjected: false,
    realisticBalanceCents: input.startingBalanceCents,
    optimisticBalanceCents: input.startingBalanceCents,
    conservativeBalanceCents: input.startingBalanceCents,
    recurringInflowCents: 0n,
    recurringOutflowCents: 0n,
    installmentsOutflowCents: 0n,
    estimatedCents: 0n,
    monthResultCents: 0n,
  });

  let balR = input.startingBalanceCents,
    balO = input.startingBalanceCents,
    balC = input.startingBalanceCents;
  let runwayYearMonth: string | null = null;
  let troughYearMonth = "",
    troughBalanceCents = 0n;
  let cur = nextMonth(input.anchorMonth.year, input.anchorMonth.month);

  for (let i = 0; i < input.horizonMonths; i++) {
    const key = ym(cur.year, cur.month);
    const inst = input.installmentsByMonth[key] ?? {};
    const sectionTotals: Record<string, bigint> = { ...input.recurringSectionTotals };
    let installmentsOutflow = 0n;
    for (const [id, total] of Object.entries(inst)) {
      sectionTotals[id] = (sectionTotals[id] ?? 0n) + total;
      const ct = ctById.get(id);
      // net outflow das parcelas: subtract soma; add/neutral abate; ignore não conta.
      // Mantém o invariante da decomposição (recIn − recOut − instOut + estimated = monthResult) p/ qualquer countType.
      if (ct === "subtract") installmentsOutflow += total;
      else if (ct === "add" || ct === "neutral") installmentsOutflow -= total;
    }

    const known = calculateMonthTotal(input.sections, sectionTotals);
    const resR = known + estR;

    balR += resR;
    balO += known + estO;
    balC += known + estC;
    if (runwayYearMonth === null && balR < 0n) runwayYearMonth = key;
    if (i === 0 || balR < troughBalanceCents) {
      troughBalanceCents = balR;
      troughYearMonth = key;
    }

    points.push({
      yearMonth: key,
      label: formatMonthLabel(cur.year, cur.month),
      isProjected: true,
      realisticBalanceCents: balR,
      optimisticBalanceCents: balO,
      conservativeBalanceCents: balC,
      recurringInflowCents: recurringInflow,
      recurringOutflowCents: recurringOutflow,
      installmentsOutflowCents: installmentsOutflow,
      estimatedCents: estR,
      monthResultCents: resR,
    });
    cur = nextMonth(cur.year, cur.month);
  }

  return {
    startingBalanceCents: input.startingBalanceCents,
    startingBalanceIsOverride: input.startingBalanceIsOverride,
    horizonMonths: input.horizonMonths,
    scenarioDefault: input.scenarioDefault,
    points,
    runwayYearMonth,
    troughYearMonth,
    troughBalanceCents,
    variableWindow: input.variableWindow,
    effectiveWindow,
    hasLowData,
    factors: { optimisticPct: input.optimisticPct, conservativePct: input.conservativePct },
  };
}

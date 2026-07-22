import type { SectionCountType } from "@prisma/client";

import { formatMonthLabel } from "@/lib/dates";
import type { Scenario } from "@/lib/schemas/forecast";
import { calculateMonthTotal } from "@/server/services/month-service";

type SectionRef = { id: string; countType: SectionCountType };

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
  // `anchorMonth`; a projeção em si começa no mês seguinte (ver nota no service
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

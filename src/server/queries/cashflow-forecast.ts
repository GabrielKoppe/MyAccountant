// ─── Spec 48 — Previsão de Fluxo de Caixa ──────────────────────────
// Query multi-tenant + React.cache que reúne os insumos (config, recorrentes,
// parcelas, histórico não-comprometido, saldo corrente) e delega a matemática
// pura a `composeForecast`. A projeção NUNCA é persistida — é recalculada por
// request. Todo BigInt é serializado para string apenas no retorno (fronteira
// RSC→Client); a acumulação interna permanece 100% BigInt.

import { cache } from "react";

import { getCurrentFiscalMonth } from "@/lib/dates";
import { SCENARIOS, type Scenario } from "@/lib/schemas/forecast";
import { prisma } from "@/server/prisma";
import {
  composeForecast,
  type ForecastInput,
  type ForecastResult,
} from "@/server/services/cashflow-forecast-service";
import { calculateMonthTotal } from "@/server/services/month-service";

type YearMonth = { year: number; month: number };

function prevMonth({ year, month }: YearMonth): YearMonth {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function nextMonth({ year, month }: YearMonth): YearMonth {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function addCalendarMonths(start: YearMonth, count: number): YearMonth {
  let cur = start;
  for (let i = 0; i < count; i++) cur = nextMonth(cur);
  return cur;
}

// "estritamente antes de" em termos de ano/mês (usado para achar meses fechados)
function isBefore(a: YearMonth, b: YearMonth): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month);
}

// ─── Serialização (borda RSC→Client): ForecastResult (bigint) → CashflowForecast (string) ───

function serialize(r: ForecastResult) {
  const s = (b: bigint) => b.toString();
  return {
    startingBalanceCents: s(r.startingBalanceCents),
    startingBalanceIsOverride: r.startingBalanceIsOverride,
    horizonMonths: r.horizonMonths,
    scenarioDefault: r.scenarioDefault,
    points: r.points.map((p) => ({
      yearMonth: p.yearMonth,
      label: p.label,
      isProjected: p.isProjected,
      realisticBalanceCents: s(p.realisticBalanceCents),
      optimisticBalanceCents: s(p.optimisticBalanceCents),
      conservativeBalanceCents: s(p.conservativeBalanceCents),
      recurringInflowCents: s(p.recurringInflowCents),
      recurringOutflowCents: s(p.recurringOutflowCents),
      installmentsOutflowCents: s(p.installmentsOutflowCents),
      estimatedCents: s(p.estimatedCents),
      monthResultCents: s(p.monthResultCents),
    })),
    runwayYearMonth: r.runwayYearMonth,
    troughYearMonth: r.troughYearMonth,
    troughBalanceCents: s(r.troughBalanceCents),
    variableWindow: r.variableWindow,
    effectiveWindow: r.effectiveWindow,
    hasLowData: r.hasLowData,
    factors: r.factors,
  };
}

export type CashflowForecast = ReturnType<typeof serialize>;

// ─── Query principal ───────────────────────────────────────────────

export const getCashflowForecast = cache(async function getCashflowForecast(
  accountId: string,
): Promise<CashflowForecast> {
  // 1. Config da account (accountId é @id em AccountSettings — filtro de tenant já embutido).
  //    Sem linha de settings ainda (conta nova) → defaults (mesmos do schema Prisma/Zod).
  const settingsRow = await prisma.accountSettings.findUnique({
    where: { accountId },
    select: {
      monthStartDay: true,
      forecastHorizonMonths: true,
      forecastScenario: true,
      forecastOptimisticPct: true,
      forecastConservativePct: true,
      forecastVariableWindow: true,
      forecastStartBalanceCents: true,
    },
  });

  const monthStartDay = settingsRow?.monthStartDay ?? 1;
  const horizonMonths = settingsRow?.forecastHorizonMonths ?? 6;
  const rawScenario = settingsRow?.forecastScenario ?? "realistic";
  const scenarioDefault: Scenario = (SCENARIOS as readonly string[]).includes(rawScenario)
    ? (rawScenario as Scenario)
    : "realistic";
  const optimisticPct = settingsRow?.forecastOptimisticPct ?? 15;
  const conservativePct = settingsRow?.forecastConservativePct ?? 15;
  const variableWindow = settingsRow?.forecastVariableWindow ?? 6;
  const startBalanceOverrideCents = settingsRow?.forecastStartBalanceCents ?? null;

  // 2. Mês fiscal corrente + âncora (último mês fechado = mês imediatamente anterior).
  const currentFiscal = getCurrentFiscalMonth(new Date(), monthStartDay);
  const anchorMonth = prevMonth(currentFiscal);

  // 3. Seções da account (cobre tanto autoSectionId de recorrentes quanto sectionId
  //    de parcelas/estimado — inclusive seções inativas, cujo countType ainda é
  //    necessário para não descartar silenciosamente sua contribuição).
  const sections = await prisma.section.findMany({
    where: { accountId }, // ✅ multi-tenancy
    select: { id: true, countType: true },
  });

  // 4. Meses fechados = todos os Month da account estritamente antes do mês fiscal corrente.
  const allMonths = await prisma.month.findMany({
    where: { accountId }, // ✅ multi-tenancy
    select: { id: true, year: true, month: true },
  });
  const closedMonths = allMonths
    .filter((m) => isBefore(m, currentFiscal))
    .sort((a, b) => a.year - b.year || a.month - b.month);
  const closedMonthCount = closedMonths.length;

  // 5. Saldo de partida: override ?? Σ calculateMonthTotal dos meses fechados
  //    (totais por mês vindos de UM groupBy em lote — evita N queries).
  let startingBalanceCents = 0n;
  const startingBalanceIsOverride = startBalanceOverrideCents != null;
  if (startingBalanceIsOverride) {
    startingBalanceCents = startBalanceOverrideCents!;
  } else if (closedMonths.length > 0) {
    const closedMonthIds = closedMonths.map((m) => m.id);
    const closedTotalsRows = await prisma.transaction.groupBy({
      by: ["monthId", "sectionId"],
      where: {
        accountId, // ✅ multi-tenancy
        monthId: { in: closedMonthIds },
        table: { countInMonth: true },
      },
      _sum: { amountCents: true },
    });

    const totalsByMonth = new Map<string, Record<string, bigint>>();
    for (const row of closedTotalsRows) {
      const rec = totalsByMonth.get(row.monthId) ?? {};
      rec[row.sectionId] = row._sum.amountCents ?? 0n;
      totalsByMonth.set(row.monthId, rec);
    }
    for (const m of closedMonths) {
      startingBalanceCents += calculateMonthTotal(sections, totalsByMonth.get(m.id) ?? {});
    }
  }

  // 6. Recorrentes (TableTemplate.autoApply): Σ items.amountCents por autoSectionId.
  //    Igual em todo mês do horizonte.
  const templates = await prisma.tableTemplate.findMany({
    where: { accountId, autoApply: true }, // ✅ multi-tenancy
    select: { autoSectionId: true, items: { select: { amountCents: true } } },
  });
  const recurringSectionTotals: Record<string, bigint> = {};
  for (const t of templates) {
    if (!t.autoSectionId) continue;
    const sum = t.items.reduce((acc, item) => acc + item.amountCents, 0n);
    recurringSectionTotals[t.autoSectionId] = (recurringSectionTotals[t.autoSectionId] ?? 0n) + sum;
  }

  // 7. Parcelas (PendingInstallment) no horizonte, bucketizadas por mês-calendário
  //    (espelha convertPendingInstallmentsForMonth) × sectionId do InstallmentGroup.
  const lastHorizonMonth = addCalendarMonths(currentFiscal, horizonMonths - 1);
  // Construção em UTC: expectedDate é @db.Date (materializado como meia-noite UTC),
  // então os limites do range precisam casar em UTC para não deslocar a borda do
  // range num fuso horário local com offset negativo/positivo.
  const rangeStart = new Date(Date.UTC(currentFiscal.year, currentFiscal.month - 1, 1));
  const rangeEnd = new Date(
    Date.UTC(lastHorizonMonth.year, lastHorizonMonth.month, 0, 23, 59, 59, 999),
  );

  const installmentRows = await prisma.pendingInstallment.findMany({
    where: {
      accountId, // ✅ multi-tenancy
      expectedDate: { gte: rangeStart, lte: rangeEnd },
    },
    select: {
      amountCents: true,
      expectedDate: true,
      group: { select: { sectionId: true } },
    },
  });
  const installmentsByMonth: Record<string, Record<string, bigint>> = {};
  for (const row of installmentRows) {
    // getUTCFullYear/getUTCMonth: expectedDate é @db.Date (materializado como
    // meia-noite UTC) — os getters UTC tornam o bucketing independente do fuso
    // horário do processo (getFullYear/getMonth locais poderiam deslocar a linha
    // para o mês adjacente conforme o TZ do servidor).
    const y = row.expectedDate.getUTCFullYear();
    const m = row.expectedDate.getUTCMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const bucket = installmentsByMonth[key] ?? {};
    bucket[row.group.sectionId] = (bucket[row.group.sectionId] ?? 0n) + row.amountCents;
    installmentsByMonth[key] = bucket;
  }

  // 8. Estimado base: média mensal do resultado líquido não-comprometido sobre
  //    effectiveWindow meses fechados mais recentes (0 se não houver histórico).
  const effectiveWindow = Math.min(variableWindow, closedMonthCount);
  let estimatedNetBaseCents = 0n;
  if (effectiveWindow > 0) {
    const windowMonthIds = closedMonths.slice(-effectiveWindow).map((m) => m.id);
    const estimatedRows = await prisma.transaction.groupBy({
      by: ["sectionId"],
      where: {
        accountId, // ✅ multi-tenancy
        monthId: { in: windowMonthIds },
        source: { not: "auto_template" }, // exclui recorrentes (já contados como conhecido)
        installmentGroupId: null, // exclui parcelas (já contadas como conhecido)
        // exclui gastos únicos (one_time); inclui fixed/variable e também NULL (imports CSV, spec 41
        // §linha 131) — `expenseType: { not: "one_time" }` sozinho excluiria NULL: em Postgres,
        // `expense_type <> 'one_time'` avalia para NULL (not-true) quando a coluna é NULL, então o
        // OR abaixo é necessário para não subcontar despesa e superestimar o caixa (spec 48 §3.3).
        OR: [{ expenseType: null }, { expenseType: { not: "one_time" } }],
        table: { countInMonth: true }, // exclui tabelas draft/planejamento (mesmo filtro do saldo de partida)
      },
      _sum: { amountCents: true },
    });
    const totals: Record<string, bigint> = {};
    for (const row of estimatedRows) totals[row.sectionId] = row._sum.amountCents ?? 0n;
    const netOverWindow = calculateMonthTotal(sections, totals);
    // Divisão de média com BigInt: nunca bigint/bigint (trunca) — skill money-handling.
    estimatedNetBaseCents = BigInt(Math.round(Number(netOverWindow) / effectiveWindow));
  }

  // 9. Compõe o input e delega a matemática pura ao service (Task 4).
  const input: ForecastInput = {
    startingBalanceCents,
    startingBalanceIsOverride,
    horizonMonths,
    scenarioDefault,
    optimisticPct,
    conservativePct,
    variableWindow,
    closedMonthCount,
    estimatedNetBaseCents,
    recurringSectionTotals,
    installmentsByMonth,
    sections,
    anchorMonth,
  };

  // 10. Serializa BigInt → string na fronteira RSC→Client.
  return serialize(composeForecast(input));
});

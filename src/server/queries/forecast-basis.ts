// ─── Spec 71 §7.2 — insumos da projeção, independentes de parâmetro ─────────
// Query multi-tenant + React.cache que reúne o material bruto da conta
// (histórico fechado, recorrentes, parcelas, seções) SEM aplicar nenhum
// parâmetro de projeção. Quem aplica horizonte/janela/origem do saldo é
// `deriveForecastInput` (`src/lib/forecast/project.ts`), tanto no servidor
// (`getCashflowForecast`) quanto no client (preview ao vivo de Configurações).
//
// Por ser param-independente, o basis é dimensionado pelos TETOS
// (`MAX_HORIZON_MONTHS`, `MAX_ESTIMATION_WINDOW`), não pelo valor salvo: o
// usuário pode arrastar o slider até o máximo sem novo round-trip.
//
// Todo BigInt permanece BigInt aqui — a serialização para string acontece só na
// fronteira RSC→Client de quem consome.

import { cache } from "react";

import { getCurrentFiscalMonth } from "@/lib/dates";
import {
  MAX_ESTIMATION_WINDOW,
  MAX_HORIZON_MONTHS,
  type ForecastBasis,
  type MonthlyAggregate,
} from "@/lib/forecast/project";
import { calculateMonthTotal } from "@/lib/month-total";
import { prisma } from "@/server/prisma";

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

const ym = ({ year, month }: YearMonth) => `${year}-${String(month).padStart(2, "0")}`;

/** monthId → (sectionId → Σ centavos), a partir de um groupBy por [monthId, sectionId]. */
function totalsByMonth(
  rows: { monthId: string; sectionId: string; _sum: { amountCents: bigint | null } }[],
): Map<string, Record<string, bigint>> {
  const map = new Map<string, Record<string, bigint>>();
  for (const row of rows) {
    const rec = map.get(row.monthId) ?? {};
    rec[row.sectionId] = row._sum.amountCents ?? 0n;
    map.set(row.monthId, rec);
  }
  return map;
}

/**
 * Linha de `AccountSettings` com os parâmetros de projeção. Compartilhada (via
 * `cache`) entre o basis — que só precisa de `monthStartDay` — e quem lê os
 * parâmetros, para não duplicar a query no mesmo request.
 */
export const getForecastSettingsRow = cache(async function getForecastSettingsRow(
  accountId: string,
) {
  // accountId é @id em AccountSettings — o filtro de tenant já está embutido.
  return prisma.accountSettings.findUnique({
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
});

export const getForecastBasis = cache(async function getForecastBasis(
  accountId: string,
): Promise<ForecastBasis> {
  // 1. Mês fiscal corrente + âncora (último mês fechado = mês imediatamente anterior).
  const settingsRow = await getForecastSettingsRow(accountId);
  const monthStartDay = settingsRow?.monthStartDay ?? 1;
  const currentFiscal = getCurrentFiscalMonth(new Date(), monthStartDay);
  const anchorMonth = prevMonth(currentFiscal);

  // 2. Parcelas: sempre até o horizonte MÁXIMO (o slider do preview pode ir até lá).
  const lastHorizonMonth = addCalendarMonths(currentFiscal, MAX_HORIZON_MONTHS - 1);
  // Construção em UTC: expectedDate é @db.Date (materializado como meia-noite UTC),
  // então os limites do range precisam casar em UTC para não deslocar a borda do
  // range num fuso horário local com offset negativo/positivo.
  const rangeStart = new Date(Date.UTC(currentFiscal.year, currentFiscal.month - 1, 1));
  const rangeEnd = new Date(
    Date.UTC(lastHorizonMonth.year, lastHorizonMonth.month, 0, 23, 59, 59, 999),
  );

  const [sections, allMonths, templates, installmentRows] = await Promise.all([
    // Seções da account (cobre tanto autoSectionId de recorrentes quanto sectionId
    // de parcelas/estimado — inclusive seções inativas, cujo countType ainda é
    // necessário para não descartar silenciosamente sua contribuição).
    prisma.section.findMany({
      where: { accountId }, // ✅ multi-tenancy
      select: { id: true, countType: true },
    }),
    prisma.month.findMany({
      where: { accountId }, // ✅ multi-tenancy
      select: { id: true, year: true, month: true },
    }),
    // Recorrentes (TableTemplate.autoApply): Σ items.amountCents por autoSectionId.
    prisma.tableTemplate.findMany({
      where: { accountId, autoApply: true }, // ✅ multi-tenancy
      select: { autoSectionId: true, items: { select: { amountCents: true } } },
    }),
    prisma.pendingInstallment.findMany({
      where: {
        accountId, // ✅ multi-tenancy
        expectedDate: { gte: rangeStart, lte: rangeEnd },
        // Parcela marcada como paga fora do app já saiu do bolso — não é
        // compromisso futuro a projetar (spec 73 §2.5).
        settledAt: null,
      },
      select: {
        amountCents: true,
        expectedDate: true,
        group: { select: { sectionId: true } },
      },
    }),
  ]);

  // 3. Meses fechados = todos os Month da account estritamente antes do mês fiscal corrente.
  const closed = allMonths
    .filter((m) => isBefore(m, currentFiscal))
    .sort((a, b) => a.year - b.year || a.month - b.month);
  const closedIds = closed.map((m) => m.id);
  // Janela de estimativa: só os N meses mais recentes cabem no teto configurável.
  const windowMonths = closed.slice(-MAX_ESTIMATION_WINDOW);
  const windowIds = windowMonths.map((m) => m.id);

  const [closedTotalsRows, uncommittedRows] = await Promise.all([
    // Net de CADA mês fechado — base do saldo de partida calculado. Rodado sempre
    // (mesmo havendo saldo informado à mão), porque o preview precisa mostrar o
    // efeito de trocar a origem do saldo sem ida ao servidor.
    closedIds.length > 0
      ? prisma.transaction.groupBy({
          by: ["monthId", "sectionId"],
          where: {
            accountId, // ✅ multi-tenancy
            monthId: { in: closedIds },
            table: { countInMonth: true },
          },
          _sum: { amountCents: true },
        })
      : Promise.resolve([]),
    // Net NÃO-COMPROMETIDO de cada mês da janela máxima — base da média estimada.
    windowIds.length > 0
      ? prisma.transaction.groupBy({
          by: ["monthId", "sectionId"],
          where: {
            accountId, // ✅ multi-tenancy
            monthId: { in: windowIds },
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
        })
      : Promise.resolve([]),
  ]);

  const closedByMonth = totalsByMonth(closedTotalsRows);
  const closedMonths: MonthlyAggregate[] = closed.map((m) => ({
    yearMonth: ym(m),
    netCents: calculateMonthTotal(sections, closedByMonth.get(m.id) ?? {}),
  }));

  const uncommittedByMonth = totalsByMonth(uncommittedRows);
  const uncommittedMonths: MonthlyAggregate[] = windowMonths.map((m) => ({
    yearMonth: ym(m),
    netCents: calculateMonthTotal(sections, uncommittedByMonth.get(m.id) ?? {}),
  }));

  const recurringSectionTotals: Record<string, bigint> = {};
  for (const t of templates) {
    if (!t.autoSectionId) continue;
    const sum = t.items.reduce((acc, item) => acc + item.amountCents, 0n);
    recurringSectionTotals[t.autoSectionId] = (recurringSectionTotals[t.autoSectionId] ?? 0n) + sum;
  }

  // Parcelas bucketizadas por mês-calendário (espelha convertPendingInstallmentsForMonth)
  // × sectionId do InstallmentGroup.
  const installmentsByMonth: Record<string, Record<string, bigint>> = {};
  for (const row of installmentRows) {
    // getUTCFullYear/getUTCMonth: expectedDate é @db.Date (materializado como
    // meia-noite UTC) — os getters UTC tornam o bucketing independente do fuso
    // horário do processo (getFullYear/getMonth locais poderiam deslocar a linha
    // para o mês adjacente conforme o TZ do servidor).
    const key = ym({
      year: row.expectedDate.getUTCFullYear(),
      month: row.expectedDate.getUTCMonth() + 1,
    });
    const bucket = installmentsByMonth[key] ?? {};
    bucket[row.group.sectionId] = (bucket[row.group.sectionId] ?? 0n) + row.amountCents;
    installmentsByMonth[key] = bucket;
  }

  return {
    sections,
    closedMonths,
    uncommittedMonths,
    recurringSectionTotals,
    installmentsByMonth,
    anchorMonth,
  };
});

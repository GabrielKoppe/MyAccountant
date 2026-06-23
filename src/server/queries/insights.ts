import { cache } from "react";

import { prisma } from "@/server/prisma";
import { getMonthRange } from "@/lib/dates";
import { getBudgetsWithProgress } from "@/server/queries/budgets";

// ─── Tipos ────────────────────────────────────────────────────────
//
// O query layer entrega dados já agregados e serializados (BigInt → string).
// As regras puras em `insights-service.ts` consomem estes dados — nunca tocam
// no Prisma diretamente (ver spec 34 §6 e skills/testing).

export type CurrentCategoryExpense = {
  categoryId: string;
  name: string;
  cents: string;
};

export type BudgetRisk = {
  id: string;
  label: string;
  percent: number;
};

export type AdherenceHistory = {
  id: string;
  label: string;
  // Percentuais nos meses em que a meta existiu, em ordem cronológica
  // (mais antigo → atual). Inclui o mês atual + até 2 anteriores.
  percents: number[];
};

export type InsightsQueryData = {
  // INS-01 / INS-02 — despesa por categoria
  currentCategories: CurrentCategoryExpense[];
  // categoryId → despesas (cents) dos meses anteriores COM DADOS, mais recente primeiro, até 3.
  priorCategoryExpenses: Record<string, string[]>;
  // INS-03 — metas em risco no mês visualizado
  budgetsCurrent: BudgetRisk[];
  // INS-04 — histórico de aderência por meta (somente meses em que existiu)
  adherenceHistory: AdherenceHistory[];
  // Dias restantes do mês fiscal — apenas quando isCurrentMonth (senão null)
  daysRemaining: number | null;
};

// Janela de lookback para detectar "meses anteriores com dados" por categoria.
// 6 meses cobre o horizonte usado no resto do dashboard (sparkline) e é
// suficiente para encontrar 3 meses com dados em uso típico, mantendo a query
// limitada. Por categoria, pegamos os 3 mais recentes com despesa > 0.
const PRIOR_LOOKBACK_MONTHS = 6;
const SPIKE_HISTORY_SIZE = 3;

const MS_PER_DAY = 86_400_000;

function shiftYearMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

// ─── Query principal ──────────────────────────────────────────────

export const getInsightsData = cache(async function getInsightsData(
  accountId: string,
  monthId: string,
  options: { isCurrentMonth: boolean },
): Promise<InsightsQueryData> {
  const empty: InsightsQueryData = {
    currentCategories: [],
    priorCategoryExpenses: {},
    budgetsCurrent: [],
    adherenceHistory: [],
    daysRemaining: null,
  };

  const month = await prisma.month.findFirst({
    where: { id: monthId, accountId },
    select: { year: true, month: true },
  });
  if (!month) return empty;
  const { year, month: monthNum } = month;

  const settings = await prisma.accountSettings.findUnique({
    where: { accountId },
    select: { monthStartDay: true },
  });
  const monthStartDay = settings?.monthStartDay ?? 1;

  // Seções de saída (despesa = countType "subtract"; ver spec 34 §7.4)
  const subtractSections = await prisma.section.findMany({
    where: { accountId, countType: "subtract" },
    select: { id: true },
  });
  const subtractIds = subtractSections.map((s) => s.id);

  // Meses anteriores existentes (mais recentes primeiro), limitados à janela.
  const priorMonths = await prisma.month.findMany({
    where: {
      accountId,
      OR: [{ year: { lt: year } }, { year, month: { lt: monthNum } }],
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: PRIOR_LOOKBACK_MONTHS,
    select: { id: true, year: true, month: true },
  });

  const [currentCategories, priorCategoryExpenses] = await getCategoryExpenses(
    accountId,
    monthId,
    priorMonths.map((m) => m.id),
    subtractIds,
  );

  // ── Metas: mês atual + 2 meses anteriores (para INS-03 e INS-04) ──
  const prior1 = shiftYearMonth(year, monthNum, -1);
  const prior2 = shiftYearMonth(year, monthNum, -2);

  const [budgetsCur, budgetsP1, budgetsP2, budgetCreatedAt] = await Promise.all([
    getBudgetsWithProgress(accountId, year, monthNum),
    getBudgetsWithProgress(accountId, prior1.year, prior1.month),
    getBudgetsWithProgress(accountId, prior2.year, prior2.month),
    prisma.budget.findMany({ where: { accountId }, select: { id: true, createdAt: true } }),
  ]);

  const createdAtMap = new Map(budgetCreatedAt.map((b) => [b.id, b.createdAt]));

  const budgetsCurrent: BudgetRisk[] = budgetsCur.map((b) => ({
    id: b.id,
    label: b.label,
    percent: b.percent,
  }));

  // Existência: a meta existiu em (year, month) se foi criada até o fim fiscal daquele mês.
  function existedIn(budgetId: string, y: number, mo: number): boolean {
    const createdAt = createdAtMap.get(budgetId);
    if (!createdAt) return false;
    const { end } = getMonthRange(y, mo, monthStartDay);
    return createdAt.getTime() <= end.getTime();
  }

  const p1ById = new Map(budgetsP1.map((b) => [b.id, b.percent]));
  const p2ById = new Map(budgetsP2.map((b) => [b.id, b.percent]));

  const adherenceHistory: AdherenceHistory[] = budgetsCur.map((b) => {
    const percents: number[] = [];
    // ordem cronológica: prior2 → prior1 → atual; só inclui meses em que existiu
    if (p2ById.has(b.id) && existedIn(b.id, prior2.year, prior2.month)) {
      percents.push(p2ById.get(b.id)!);
    }
    if (p1ById.has(b.id) && existedIn(b.id, prior1.year, prior1.month)) {
      percents.push(p1ById.get(b.id)!);
    }
    percents.push(b.percent); // mês atual sempre existe
    return { id: b.id, label: b.label, percents };
  });

  // ── Dias restantes do mês fiscal (somente mês atual) ──
  let daysRemaining: number | null = null;
  if (options.isCurrentMonth) {
    const { end } = getMonthRange(year, monthNum, monthStartDay);
    const diff = end.getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / MS_PER_DAY));
  }

  return {
    currentCategories,
    priorCategoryExpenses,
    budgetsCurrent,
    adherenceHistory,
    daysRemaining,
  };
});

// ─── Despesa por categoria (mês atual + janela anterior) ──────────

async function getCategoryExpenses(
  accountId: string,
  currentMonthId: string,
  priorMonthIds: string[],
  subtractIds: string[],
): Promise<[CurrentCategoryExpense[], Record<string, string[]>]> {
  if (subtractIds.length === 0) return [[], {}];

  const allMonthIds = [currentMonthId, ...priorMonthIds];

  // Uma única groupBy por (monthId, categoryId) cobrindo mês atual + anteriores.
  const rows = await prisma.transaction.groupBy({
    by: ["monthId", "categoryId"],
    where: {
      accountId,
      monthId: { in: allMonthIds },
      sectionId: { in: subtractIds },
      categoryId: { not: null },
      amountCents: { gt: 0n },
      table: { countInMonth: true },
    },
    _sum: { amountCents: true },
  });

  // current: categoryId → cents; prior: categoryId → [{ monthId, cents }]
  const currentMap = new Map<string, bigint>();
  const priorMap = new Map<string, Map<string, bigint>>();

  for (const row of rows) {
    if (!row.categoryId) continue;
    const cents = row._sum.amountCents ?? 0n;
    if (cents <= 0n) continue;
    if (row.monthId === currentMonthId) {
      currentMap.set(row.categoryId, cents);
    } else {
      if (!priorMap.has(row.categoryId)) priorMap.set(row.categoryId, new Map());
      priorMap.get(row.categoryId)!.set(row.monthId, cents);
    }
  }

  // Resolver nomes das categorias presentes no mês atual
  const currentIds = [...currentMap.keys()];
  const names =
    currentIds.length > 0
      ? await prisma.category.findMany({
          where: { id: { in: currentIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameMap = new Map(names.map((c) => [c.id, c.name]));

  const currentCategories: CurrentCategoryExpense[] = currentIds.map((categoryId) => ({
    categoryId,
    name: nameMap.get(categoryId) ?? "—",
    cents: currentMap.get(categoryId)!.toString(),
  }));

  // priorMonthIds já vem mais-recente-primeiro; por categoria pega os 3 com dados.
  const priorCategoryExpenses: Record<string, string[]> = {};
  for (const [categoryId, monthCents] of priorMap) {
    const ordered: string[] = [];
    for (const mId of priorMonthIds) {
      const cents = monthCents.get(mId);
      if (cents !== undefined && cents > 0n) {
        ordered.push(cents.toString());
        if (ordered.length >= SPIKE_HISTORY_SIZE) break;
      }
    }
    if (ordered.length > 0) priorCategoryExpenses[categoryId] = ordered;
  }

  return [currentCategories, priorCategoryExpenses];
}

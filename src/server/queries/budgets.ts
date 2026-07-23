import { cache } from "react";

import type { Prisma, TransactionExpenseType } from "@prisma/client";
import { getBudgetLabel } from "@/components/budgets/budget-label";
import { prisma } from "@/server/prisma";
import { responsiblePartyIdsForFilter, partyDisplayMap } from "./responsible-party-filter";

// Re-export para preservar a API pública `getBudgetLabel` (consumida por
// budgets.test.ts e internamente aqui). O helper foi movido para um módulo PURO
// e client-safe (`components/budgets/budget-label.ts`) porque a aba
// `planning/budgets` (client) precisa do rótulo e não pode importar este arquivo
// (que puxa `prisma`) em runtime.
export { getBudgetLabel } from "@/components/budgets/budget-label";

// ═════════════════════════════════════════════════════════════════════════════
// DESIGN — Orçamento multi-dimensão + interseção (Spec 25)
//
// Cada orçamento tem 5 dimensões, cada uma um ARRAY de ids (sectionIds,
// categoryIds, memberUserIds, institutionIds, tableTypeIds). O "gasto" de um
// orçamento é a soma das transações-despesa (amountCents > 0) do mês que casam
// com o filtro derivado dessas dimensões.
//
// Semântica da interseção:
//   • AND entre dimensões NÃO-vazias — a transação precisa satisfazer TODAS as
//     dimensões que o orçamento restringe (ex: seção X E instituição Y).
//   • OR dentro de uma dimensão — via `{ in: [...] }`: qualquer id daquela
//     dimensão serve (ex: categoria A OU categoria B).
//   • Dimensão VAZIA = sem restrição naquela dimensão (não entra no AND).
//
// Mapeamento dimensão → coluna de Transaction (`budgetDimensionWhere`):
//   sectionIds     → transaction.sectionId            ∈ sectionIds
//   categoryIds    → transaction.categoryId           ∈ categoryIds
//   institutionIds → transaction.institutionId        ∈ institutionIds
//   tableTypeIds   → transaction.table.tableTypeId    ∈ tableTypeIds
//   memberUserIds  → transaction.responsiblePartyId   ∈ responsibleParties (a dimensão
//                    "membro" virou "responsável": guarda partyId de QUALQUER kind
//                    personal/group/external. Tolera userId legado → sua party `personal`
//                    via responsiblePartyIdsForFilter.)
//
// Quando sectionIds está vazio, excluímos transações de seções `countType:"ignore"`
// para não inflar orçamentos de categoria/membro/instituição/tipo com lançamentos
// que o mês inteiro ignora. Espelha o comportamento escalar anterior.
// ═════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────

type DimDetail = { id: string; name: string };
type MemberDetail = { id: string; name: string | null };

export type BudgetWithDetails = {
  id: string;
  name: string | null;
  // Ids crus persistidos (fonte para o form de edição).
  sectionIds: string[];
  categoryIds: string[];
  memberUserIds: string[];
  institutionIds: string[];
  tableTypeIds: string[];
  // Nomes resolvidos por accountId para exibição (ids órfãos — entidade deletada —
  // são filtrados fora, então a lista de nomes pode ser mais curta que a de ids).
  sections: DimDetail[];
  categories: DimDetail[];
  members: MemberDetail[];
  institutions: DimDetail[];
  tableTypes: DimDetail[];
  amountCents: string;
  alertThresholdPercent: number;
  isRecurring: boolean;
  showInSummary: boolean;
  year: number | null;
  month: number | null;
};

export type BudgetProgress = BudgetWithDetails & {
  spentCents: string;
  percent: number;
  label: string;
};

// Status de um orçamento em UM mês (Spec 25 — visão CONFIG + HISTÓRICO).
//   "exceeded" → percent >= 100 (estourou o teto)
//   "alert"    → percent >= alertThresholdPercent (mas < 100)
//   "ok"       → abaixo do limiar de alerta
export type BudgetMonthStatus = "ok" | "alert" | "exceeded";

export type BudgetHistoryEntry = {
  year: number;
  month: number;
  monthId: string;
  status: BudgetMonthStatus;
  percent: number;
  spentCents: string;
};

// Orçamento (config serializada) + histórico de status por mês existente da account.
export type BudgetConfigWithHistory = BudgetWithDetails & {
  history: BudgetHistoryEntry[];
};

export type BudgetFormOptions = {
  sections: DimDetail[];
  categories: DimDetail[];
  // "Membro" virou "Responsável": todas as responsibleParties da account (personal/group/
  // external), id = partyId, name = nome de exibição (partyDisplayMap). Chave mantida como
  // `members` para menor blast no restante do código.
  members: DimDetail[];
  institutions: DimDetail[];
  tableTypes: DimDetail[];
};

// Colunas de dimensão cruas de um Budget (arrays de ids).
type BudgetDimensions = {
  sectionIds: string[];
  categoryIds: string[];
  memberUserIds: string[];
  institutionIds: string[];
  tableTypeIds: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Constrói o filtro de dimensões de Transaction para um orçamento (ver DESIGN no topo).
 * Assíncrono porque a dimensão "responsável" (`memberUserIds`) exige resolver os valores para
 * `responsiblePartyId`s da account (partyId direto + tolerância a userId legado).
 * O caller compõe este `where` com a base (accountId/monthId/amountCents/expenseType).
 */
export async function budgetDimensionWhere(
  budget: BudgetDimensions,
  accountId: string,
): Promise<Prisma.TransactionWhereInput> {
  const where: Prisma.TransactionWhereInput = {};

  if (budget.sectionIds.length > 0) {
    where.sectionId = { in: budget.sectionIds };
  } else {
    // Sem seção específica: não deixa seções "ignore" inflarem o gasto.
    where.section = { countType: { not: "ignore" } };
  }

  if (budget.categoryIds.length > 0) where.categoryId = { in: budget.categoryIds };
  if (budget.institutionIds.length > 0) where.institutionId = { in: budget.institutionIds };
  if (budget.tableTypeIds.length > 0) {
    where.table = { tableTypeId: { in: budget.tableTypeIds } };
  }
  if (budget.memberUserIds.length > 0) {
    const pids = await responsiblePartyIdsForFilter(accountId, budget.memberUserIds);
    where.responsiblePartyId = { in: pids };
  }

  return where;
}

// Maps id → detalhe de cada dimensão da account, para resolver nomes de exibição.
type DimensionMaps = {
  sections: Map<string, DimDetail>;
  categories: Map<string, DimDetail>;
  members: Map<string, MemberDetail>;
  institutions: Map<string, DimDetail>;
  tableTypes: Map<string, DimDetail>;
};

async function loadDimensionMaps(accountId: string): Promise<DimensionMaps> {
  // A dimensão "responsável" resolve NOME por partyId (partyDisplayMap). Budget legado que
  // guardou userId (não partyId) não casa aqui → orfão descartado por `resolve()` (aceitável).
  const [sections, categories, partyNames, institutions, tableTypes] = await Promise.all([
    prisma.section.findMany({ where: { accountId }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { accountId }, select: { id: true, name: true } }),
    partyDisplayMap(accountId),
    prisma.institution.findMany({ where: { accountId }, select: { id: true, name: true } }),
    prisma.tableType.findMany({ where: { accountId }, select: { id: true, name: true } }),
  ]);
  return {
    sections: new Map(sections.map((s) => [s.id, s])),
    categories: new Map(categories.map((c) => [c.id, c])),
    members: new Map([...partyNames].map(([id, name]) => [id, { id, name }])),
    institutions: new Map(institutions.map((i) => [i.id, i])),
    tableTypes: new Map(tableTypes.map((t) => [t.id, t])),
  };
}

// Resolve os ids de uma dimensão para os detalhes, DESCARTANDO ids órfãos (entidade
// deletada) — mantém a ordem persistida dos ids que sobrevivem.
function resolve<T>(ids: string[], map: Map<string, T>): T[] {
  const out: T[] = [];
  for (const id of ids) {
    const hit = map.get(id);
    if (hit) out.push(hit);
  }
  return out;
}

type BudgetRow = BudgetDimensions & {
  id: string;
  name: string | null;
  amountCents: bigint;
  alertThresholdPercent: number;
  isRecurring: boolean;
  showInSummary: boolean;
  year: number | null;
  month: number | null;
};

function serializeBudget(b: BudgetRow, maps: DimensionMaps): BudgetWithDetails {
  return {
    id: b.id,
    name: b.name,
    sectionIds: b.sectionIds,
    categoryIds: b.categoryIds,
    memberUserIds: b.memberUserIds,
    institutionIds: b.institutionIds,
    tableTypeIds: b.tableTypeIds,
    sections: resolve(b.sectionIds, maps.sections),
    categories: resolve(b.categoryIds, maps.categories),
    members: resolve(b.memberUserIds, maps.members),
    institutions: resolve(b.institutionIds, maps.institutions),
    tableTypes: resolve(b.tableTypeIds, maps.tableTypes),
    amountCents: b.amountCents.toString(),
    alertThresholdPercent: b.alertThresholdPercent,
    isRecurring: b.isRecurring,
    showInSummary: b.showInSummary,
    year: b.year,
    month: b.month,
  };
}

// ─── Queries ──────────────────────────────────────────────────────

export const getBudgetsForSettings = cache(async function getBudgetsForSettings(
  accountId: string,
): Promise<BudgetWithDetails[]> {
  const [budgets, maps] = await Promise.all([
    prisma.budget.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
    loadDimensionMaps(accountId),
  ]);
  return budgets.map((b) => serializeBudget(b, maps));
});

export const getBudgetFormOptions = cache(async function getBudgetFormOptions(
  accountId: string,
): Promise<BudgetFormOptions> {
  const [sections, categories, partyNames, institutions, tableTypes] = await Promise.all([
    prisma.section.findMany({
      where: { accountId, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // "Responsável": todas as responsibleParties da account (personal/group/external),
    // id = partyId, name = nome de exibição. Ordenado por nome.
    partyDisplayMap(accountId),
    prisma.institution.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.tableType.findMany({
      where: { accountId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const members = [...partyNames]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { sections, categories, members, institutions, tableTypes };
});

// Spec 41 Fase 14: filterExpenseType filtra as transações que contam para o spending.
export const getBudgetsWithProgress = cache(async function getBudgetsWithProgress(
  accountId: string,
  year: number,
  month: number,
  onlyShowInSummary = false,
  filterExpenseType?: TransactionExpenseType,
): Promise<BudgetProgress[]> {
  // NÃO exigimos que a `Month` do mês corrente exista. Uma conta que ainda não abriu o mês
  // vigente não tem transações nele (toda transação pertence a uma `Month`), então o gasto é
  // 0 — mas os orçamentos configurados DEVEM aparecer (com progresso 0). O antigo
  // `if (!monthRecord) return []` escondia TODOS os orçamentos até o mês ser criado —
  // regressão ao migrar de `settings/budgets` (que usava `getBudgetsForSettings`, sem guard de
  // mês) para a aba `planning/budgets` (que usa esta query para exibir progresso do mês).
  const monthRecord = await prisma.month.findUnique({
    where: { accountId_year_month: { accountId, year, month } },
    select: { id: true },
  });

  const [budgets, maps] = await Promise.all([
    prisma.budget.findMany({
      where: {
        accountId,
        OR: [{ isRecurring: true }, { isRecurring: false, year, month }],
        ...(onlyShowInSummary ? { showInSummary: true } : {}),
      },
      orderBy: { createdAt: "asc" },
    }),
    loadDimensionMaps(accountId),
  ]);

  const results = await Promise.all(
    budgets.map(async (budget) => {
      const spentCents = await calcSpent(budget, accountId, monthRecord?.id, filterExpenseType);
      const targetCents = budget.amountCents > 0n ? budget.amountCents : 1n;
      const percent = Math.round(Number((spentCents * 100n) / targetCents));
      const serialized = serializeBudget(budget, maps);

      return {
        ...serialized,
        spentCents: spentCents.toString(),
        percent,
        label: getBudgetLabel(serialized),
      } satisfies BudgetProgress;
    }),
  );

  return results;
});

// Deriva o status do mês a partir do percent gasto e do limiar de alerta do orçamento.
function budgetMonthStatus(percent: number, alertThresholdPercent: number): BudgetMonthStatus {
  if (percent >= 100) return "exceeded";
  if (percent >= alertThresholdPercent) return "alert";
  return "ok";
}

/**
 * Visão AGNÓSTICA DE MÊS de /planning/budgets: para CADA orçamento da account (todos, sem
 * filtro de mês) devolve a config serializada (dimensões + nomes, via serializeBudget) mais o
 * `history` — o status de cada `Month` EXISTENTE da account (ordenados crescente; se houver
 * muitos, só os últimos ~12).
 *
 * Recorrência:
 *   • recorrente (isRecurring=true) conta em TODOS os meses existentes;
 *   • específico (isRecurring=false) conta SÓ no seu próprio year/month (demais meses omitidos
 *     do history).
 *
 * Gasto por (orçamento, mês) via `calcSpent` — aceitável para poucos meses (a query já limita a
 * ~12 Months). Multi-tenancy por accountId em toda leitura. `cache()` como as demais queries.
 */
export const getBudgetsConfigWithHistory = cache(async function getBudgetsConfigWithHistory(
  accountId: string,
): Promise<BudgetConfigWithHistory[]> {
  const [budgets, recentMonths, maps] = await Promise.all([
    prisma.budget.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
    prisma.month.findMany({
      where: { accountId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
      select: { id: true, year: true, month: true },
    }),
    loadDimensionMaps(accountId),
  ]);

  // findMany traz os mais recentes (desc); o history é exibido do mais antigo → mais recente.
  const months = [...recentMonths].reverse();

  return Promise.all(
    budgets.map(async (budget) => {
      const serialized = serializeBudget(budget, maps);
      // Meses relevantes ao orçamento: recorrente = todos; específico = só o seu year/month.
      const relevant = budget.isRecurring
        ? months
        : months.filter((m) => m.year === budget.year && m.month === budget.month);

      const history = await Promise.all(
        relevant.map(async (m) => {
          const spentCents = await calcSpent(budget, accountId, m.id);
          const targetCents = budget.amountCents > 0n ? budget.amountCents : 1n;
          const percent = Math.round(Number((spentCents * 100n) / targetCents));
          return {
            year: m.year,
            month: m.month,
            monthId: m.id,
            status: budgetMonthStatus(percent, budget.alertThresholdPercent),
            percent,
            spentCents: spentCents.toString(),
          } satisfies BudgetHistoryEntry;
        }),
      );

      return { ...serialized, history } satisfies BudgetConfigWithHistory;
    }),
  );
});

async function calcSpent(
  budget: BudgetDimensions,
  accountId: string,
  monthId: string | undefined,
  filterExpenseType?: TransactionExpenseType,
): Promise<bigint> {
  // Sem `Month` do mês corrente não há transações nele → gasto 0 (sem tocar o Prisma).
  if (!monthId) return 0n;
  const dimensionWhere = await budgetDimensionWhere(budget, accountId);
  const where: Prisma.TransactionWhereInput = {
    accountId,
    monthId,
    amountCents: { gt: 0n },
    ...(filterExpenseType ? { expenseType: filterExpenseType } : {}),
    ...dimensionWhere,
  };

  const agg = await prisma.transaction.aggregate({ where, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0n;
}

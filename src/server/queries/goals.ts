// ─── Spec 47 — Metas de Poupança: camada de leitura (Fase 4) ───────────────
// React.cache() + multi-tenancy (todo find* filtra accountId) + serialização na
// fronteira RSC→Client (BigInt→string, Date→"YYYY-MM-DD"/"YYYY-MM"). Toda
// matemática (progresso, ritmo, glide-path, split, agregado) é composta a partir de
// `goal-service.ts` (Fase 2) — este arquivo NUNCA reimplementa cálculo, só
// carrega/combina/serializa (espelha net-worth.ts/budgets.ts). Ver
// specs/47-metas-poupanca.md §4 (modelo de cálculo), §11 (referências técnicas) e
// §12 Fase 4.

import type { Prisma } from "@prisma/client";
import { cache } from "react";

import { getCurrentFiscalMonth } from "@/lib/dates";
import { serializeGoal, type SerializedGoal } from "@/lib/serializers/goal";
import { prisma } from "@/server/prisma";
import {
  addFiscalMonths,
  buildGlidePath,
  computeGoalsOverview,
  computeMemberSplit,
  computePace,
  computeProgress,
  MAX_HORIZON_MONTHS,
  maxFiscalMonth,
  minFiscalMonth,
  type FiscalMonth,
  type GlidePathPoint,
  type GoalContributionLike,
  type PaceResult,
  type ProgressResult,
} from "@/server/services/goal-service";

// ─── Helpers compartilhados ─────────────────────────────────────────────────

async function monthStartDayOf(accountId: string): Promise<number> {
  const s = await prisma.accountSettings.findUnique({
    where: { accountId },
    select: { monthStartDay: true },
  });
  return s?.monthStartDay ?? 1;
}

const ACTIVE_CONTRIBUTIONS_SELECT = {
  select: { amountCents: true, contributedOn: true },
} as const;

/** Metas ativas (archivedAt: null, DD-02) + contribuições — reusado por overview e widget. */
async function fetchActiveGoalsWithContributions(accountId: string) {
  return prisma.goal.findMany({
    where: { accountId, archivedAt: null }, // ✅ multi-tenancy — só metas ativas
    include: { contributions: ACTIVE_CONTRIBUTIONS_SELECT },
    orderBy: { createdAt: "asc" },
  });
}

/** Progresso (§4.1) + ritmo/projeção (§4.2/§4.3) de uma meta — base de toda serialização. */
function computeGoalMetrics(
  goal: { targetCents: bigint; deadline: Date | null; contributions: GoalContributionLike[] },
  currentFiscal: FiscalMonth,
  monthStartDay: number,
): { progress: ProgressResult; pace: PaceResult } {
  const progress = computeProgress(goal.targetCents, goal.contributions);
  const pace = computePace({
    targetCents: goal.targetCents,
    deadline: goal.deadline,
    contributions: goal.contributions,
    currentFiscal,
    monthStartDay,
  });
  return { progress, pace };
}

/** Combina Goal + ProgressResult + PaceResult em SerializedGoal (BigInt/Date → string, §11). */
function toSerializedGoal(
  goal: {
    id: string;
    name: string;
    targetCents: bigint;
    deadline: Date | null;
    archivedAt: Date | null;
    sectionId: string | null;
    categoryId: string | null;
  },
  progress: ProgressResult,
  pace: PaceResult,
): SerializedGoal {
  return serializeGoal({
    id: goal.id,
    name: goal.name,
    targetCents: goal.targetCents,
    progressCents: progress.progressCents,
    percent: progress.percent,
    deadline: goal.deadline,
    // Derivado (nunca o campo `isAchieved` persistido no banco) — mesma fonte que
    // progressCents/percent, então nunca diverge dentro desta resposta (defense in
    // depth; ver nota sobre lost-update em goal-service.ts:computeIsAchieved).
    isAchieved: progress.isAchieved,
    archivedAt: goal.archivedAt,
    pace: pace.pace,
    requiredMonthlyCents: pace.requiredMonthlyCents,
    projectedMonth: pace.projectedMonth,
    sectionId: goal.sectionId,
    categoryId: goal.categoryId,
  });
}

/**
 * Range do glide-path (§4.4/§11): início = o mais antigo entre `createdAt` da meta e o
 * 1º aporte (defensivo — nada impede um `contributedOn` anterior à criação da meta);
 * fim = deadline ?? projectedMonth (de computePace) ?? mês fiscal corrente.
 *
 * Refinamento (Fase 9): com deadline, o fim NÃO trava mais no mês do prazo — usa
 * `maxFiscalMonth(deadlineMonth, currentFiscal)`. Uma meta `behind` (prazo vencido)
 * continua recebendo aportes depois do deadline; travar o fim no deadline escondia
 * esses aportes posteriores da linha real (`cumulativeCents`). A linha IDEAL não é
 * afetada por essa extensão — ela permanece ancorada 0→alvo só até o deadline
 * (`buildGlidePath` zera `idealCents` para pontos além dele, goal-service.ts).
 *
 * B1 (fix wave, blocker): o fim é sempre clampado a `MAX_HORIZON_MONTHS` a partir do
 * início — um deadline muito distante (ainda que agora limitado a ~50 anos pelo
 * schema, `schemas/goal.ts`) geraria uma série de centenas de pontos; `projectedMonth`
 * já vem clampado por `computePace`, mas o deadline explícito não passava por esse
 * teto. `minFiscalMonth` garante que o clamp só entra em ação quando o fim natural
 * (deadline ou projeção) excede o teto — nunca ENCURTA um range já dentro dele.
 */
function resolveGlidePathRange(
  goal: { createdAt: Date; deadline: Date | null },
  contributions: GoalContributionLike[],
  projectedMonth: FiscalMonth | null,
  currentFiscal: FiscalMonth,
  monthStartDay: number,
): { startMonth: FiscalMonth; endMonth: FiscalMonth } {
  let earliest = goal.createdAt;
  for (const c of contributions) {
    if (c.contributedOn < earliest) earliest = c.contributedOn;
  }
  const startMonth = getCurrentFiscalMonth(earliest, monthStartDay);
  const naturalEndMonth = goal.deadline
    ? maxFiscalMonth(getCurrentFiscalMonth(goal.deadline, monthStartDay), currentFiscal)
    : (projectedMonth ?? currentFiscal);
  const endMonth = minFiscalMonth(naturalEndMonth, addFiscalMonths(startMonth, MAX_HORIZON_MONTHS));
  return { startMonth, endMonth };
}

export type SerializedGlidePathPoint = {
  year: number;
  month: number;
  cumulativeCents: string;
  idealCents: string | null;
  targetCents: string;
};

function serializeGlidePath(points: GlidePathPoint[]): SerializedGlidePathPoint[] {
  return points.map((p) => ({
    year: p.year,
    month: p.month,
    cumulativeCents: p.cumulativeCents.toString(),
    idealCents: p.idealCents !== null ? p.idealCents.toString() : null,
    targetCents: p.targetCents.toString(),
  }));
}

// ─── getGoalDimensionOptions — dimensão nos dialogs (Fase 8, §5.6) ─────────

export type GoalDimensionOptions = {
  sections: { id: string; name: string }[];
  categories: { id: string; name: string }[];
};

/**
 * Opções de `sectionId`/`categoryId` para o dialog criar/editar meta (§5.6). Query
 * LEVE e independente — não reusa `getBudgetFormOptions` (`queries/budgets.ts`) porque
 * aquela também busca membros/instituições/tipos de tabela, irrelevantes para `Goal`
 * (que só tem dimensão de seção/categoria, §2.1). Mesmo padrão de leitura (`isActive`
 * para seção, todas as categorias) usado ali.
 */
export const getGoalDimensionOptions = cache(async function getGoalDimensionOptions(
  accountId: string,
): Promise<GoalDimensionOptions> {
  const [sections, categories] = await Promise.all([
    prisma.section.findMany({
      where: { accountId, isActive: true }, // ✅ multi-tenancy
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { accountId }, // ✅ multi-tenancy
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { sections, categories };
});

// ─── getGoalsOverview — aba Metas: hero + cards (§4.6/§5.2) ────────────────

export type GoalsOverview = {
  totalSavedCents: string;
  totalTargetCents: string;
  contributedThisMonthCents: string;
  nextDeadlineGoal: { id: string; deadline: string } | null;
  counts: { onTrack: number; behind: number; achieved: number; noContribution: number };
  goals: SerializedGoal[];
};

/** Aba Metas (§4.6/§5.2). Só metas ativas (archivedAt: null, DD-02) entram no agregado. */
export const getGoalsOverview = cache(async function getGoalsOverview(
  accountId: string,
): Promise<GoalsOverview> {
  const monthStartDay = await monthStartDayOf(accountId);
  const currentFiscal = getCurrentFiscalMonth(new Date(), monthStartDay);
  const goals = await fetchActiveGoalsWithContributions(accountId);

  const aggregate = computeGoalsOverview(goals, currentFiscal, monthStartDay);

  return {
    totalSavedCents: aggregate.totalSavedCents.toString(),
    totalTargetCents: aggregate.totalTargetCents.toString(),
    contributedThisMonthCents: aggregate.contributedThisMonthCents.toString(),
    nextDeadlineGoal: aggregate.nextDeadlineGoal
      ? {
          id: aggregate.nextDeadlineGoal.id,
          deadline: aggregate.nextDeadlineGoal.deadline.toISOString().slice(0, 10),
        }
      : null,
    counts: aggregate.counts,
    goals: goals.map((g) => {
      const { progress, pace } = computeGoalMetrics(g, currentFiscal, monthStartDay);
      return toSerializedGoal(g, progress, pace);
    }),
  };
});

// ─── getArchivedGoals — seção "Arquivadas" (§5.2) ──────────────────────────

/**
 * Metas arquivadas (§5.2 "Arquivadas") — fora do agregado (DD-02), histórico
 * preservado. Serialização LEVE (§12 Fase 4): sem ritmo real — `pace` cai para
 * `achieved`/`no_contribution` conforme `isAchieved` (derivado), e
 * `requiredMonthlyCents`/`projectedMonth` ficam `null`. Uma meta arquivada saiu do
 * acompanhamento de ritmo (não faz sentido "atrasada"/"adiantada" para algo fora de
 * tracking); por isso não vale resolver `monthStartDay`/mês fiscal corrente aqui.
 */
export const getArchivedGoals = cache(async function getArchivedGoals(
  accountId: string,
): Promise<SerializedGoal[]> {
  const goals = await prisma.goal.findMany({
    where: { accountId, archivedAt: { not: null } }, // ✅ multi-tenancy
    include: { contributions: ACTIVE_CONTRIBUTIONS_SELECT },
    orderBy: { archivedAt: "desc" },
  });

  return goals.map((g) => {
    const progress = computeProgress(g.targetCents, g.contributions);
    return serializeGoal({
      id: g.id,
      name: g.name,
      targetCents: g.targetCents,
      progressCents: progress.progressCents,
      percent: progress.percent,
      deadline: g.deadline,
      isAchieved: progress.isAchieved,
      archivedAt: g.archivedAt,
      pace: progress.isAchieved ? "achieved" : "no_contribution",
      requiredMonthlyCents: null,
      projectedMonth: null,
      sectionId: g.sectionId,
      categoryId: g.categoryId,
    });
  });
});

// ─── getGoalDetail — drawer de detalhe (§5.3) ──────────────────────────────

export type GoalDetailHistoryEntry = {
  id: string;
  amountCents: string;
  contributedOn: string;
  byUserId: string;
  byUserName: string | null;
  notes: string | null;
  transactionId: string | null;
};

export type GoalDetailSplitEntry = {
  userId: string;
  userName: string;
  totalCents: string;
  percent: number;
};

export type GoalDetail = {
  goal: SerializedGoal;
  glidePath: SerializedGlidePathPoint[];
  split: GoalDetailSplitEntry[];
  history: GoalDetailHistoryEntry[];
};

/**
 * Detalhe da meta (§5.3): glide-path (§4.4) + split por membro (§4.5) + histórico de
 * aportes (mais recente primeiro). `null` quando a meta não existe OU não pertence à
 * account (multi-tenancy — nunca lança; o caller/página decide 404 via `notFound()`).
 */
export const getGoalDetail = cache(async function getGoalDetail(
  accountId: string,
  goalId: string,
): Promise<GoalDetail | null> {
  const monthStartDay = await monthStartDayOf(accountId);
  const currentFiscal = getCurrentFiscalMonth(new Date(), monthStartDay);

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, accountId }, // ✅ multi-tenancy — filtro direto no where, nunca id cru
    include: {
      contributions: {
        orderBy: { contributedOn: "desc" },
        include: { byUser: { select: { name: true } } },
      },
    },
  });
  if (!goal) return null; // não existe OU é de outra account (§7 multi-tenancy)

  const { progress, pace } = computeGoalMetrics(goal, currentFiscal, monthStartDay);

  const { startMonth, endMonth } = resolveGlidePathRange(
    goal,
    goal.contributions,
    pace.projectedMonth,
    currentFiscal,
    monthStartDay,
  );
  const glidePath = buildGlidePath({
    targetCents: goal.targetCents,
    deadline: goal.deadline,
    startMonth,
    endMonth,
    contributions: goal.contributions,
    monthStartDay,
  });

  const userNames = new Map<string, string>();
  for (const c of goal.contributions) userNames.set(c.byUserId, c.byUser.name ?? c.byUserId);
  const split = computeMemberSplit(goal.contributions, userNames);

  return {
    goal: toSerializedGoal(goal, progress, pace),
    glidePath: serializeGlidePath(glidePath),
    split: split.map((s) => ({
      userId: s.userId,
      userName: s.userName,
      totalCents: s.totalCents.toString(),
      percent: s.percent,
    })),
    history: goal.contributions.map((c) => ({
      id: c.id,
      amountCents: c.amountCents.toString(),
      contributedOn: c.contributedOn.toISOString().slice(0, 10),
      byUserId: c.byUserId,
      byUserName: c.byUser.name,
      notes: c.notes,
      transactionId: c.transactionId,
    })),
  };
});

// ─── getGoalSuggestions — aportes sugeridos (GOAL-05, §3.4) ────────────────

export type GoalSuggestion = {
  id: string;
  amountCents: string;
  occurredOn: string;
  description: string | null;
};

export type GoalSuggestionsResult = {
  /** Nome da seção/categoria da meta (`sectionId` XOR `categoryId`), resolvido 1x nesta
   * query via join — `null` quando a meta não existe/não é da account OU não tem
   * dimensão (GOAL-05). Consumido pela UI (`GoalDetailDrawer`, Fase 12) para qualificar
   * o título da seção de sugestões (ex.: "Aportes sugeridos em Poupança"). Campo à parte
   * (não repetido em cada `GoalSuggestion`) porque precisa sobreviver mesmo quando
   * `suggestions` vem vazio (ver nota abaixo). */
  dimensionLabel: string | null;
  suggestions: GoalSuggestion[];
};

/**
 * Aportes sugeridos (GOAL-05, §3.4/§11) — query NOVA (NÃO reusa getBudgetsWithProgress,
 * que agrega por orçamento específico). Reusa só o MAPEAMENTO dimensão→where
 * (budget-service.ts:127-138): `sectionId`/`categoryId` da meta. Transações do mês
 * fiscal corrente, `amountCents > 0` (magnitude = "gasto positivo", convenção do repo —
 * `calculateMonthTotal`, month-service.ts), ainda NÃO vinculadas a nenhuma
 * `GoalContribution` (`goalContributions: { none: {} }`). `suggestions` vem `[]` quando:
 * a meta não existe/não é da account; a meta não tem dimensão (GOAL-05 — sugestão
 * inerte); ou o mês fiscal corrente ainda não tem `Month` criado (conta nova) — só nos
 * dois primeiros casos `dimensionLabel` também é `null`. No 3º caso a meta TEM dimensão
 * (só não há `Month` ainda), então o nome já resolvido é preservado — é o caso mais
 * comum de "sugestões vazias" e o mais importante pra explicar o vazio na UI.
 */
export const getGoalSuggestions = cache(async function getGoalSuggestions(
  accountId: string,
  goalId: string,
): Promise<GoalSuggestionsResult> {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, accountId }, // ✅ multi-tenancy
    select: {
      sectionId: true,
      categoryId: true,
      section: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
  if (!goal) return { dimensionLabel: null, suggestions: [] };
  if (!goal.sectionId && !goal.categoryId) {
    return { dimensionLabel: null, suggestions: [] }; // GOAL-05 — sem dimensão, sugestão inerte
  }

  const dimensionLabel = goal.section?.name ?? goal.category?.name ?? null;

  const monthStartDay = await monthStartDayOf(accountId);
  const currentFiscal = getCurrentFiscalMonth(new Date(), monthStartDay);
  const monthRecord = await prisma.month.findUnique({
    where: {
      accountId_year_month: { accountId, year: currentFiscal.year, month: currentFiscal.month },
    },
    select: { id: true },
  });
  if (!monthRecord) return { dimensionLabel, suggestions: [] }; // mês fiscal corrente ainda sem Month criado

  const where: Prisma.TransactionWhereInput = {
    accountId, // ✅ multi-tenancy
    monthId: monthRecord.id,
    amountCents: { gt: 0n },
    goalContributions: { none: {} }, // ainda não vinculada a NENHUM aporte de meta
    ...(goal.sectionId ? { sectionId: goal.sectionId } : {}),
    ...(goal.categoryId ? { categoryId: goal.categoryId } : {}),
  };

  const txs = await prisma.transaction.findMany({
    where,
    orderBy: { occurredOn: "desc" },
    select: { id: true, amountCents: true, occurredOn: true, description: true },
  });

  return {
    dimensionLabel,
    suggestions: txs.map((t) => ({
      id: t.id,
      amountCents: t.amountCents.toString(), // magnitude — where já garante amountCents > 0
      occurredOn: t.occurredOn.toISOString().slice(0, 10),
      description: t.description,
    })),
  };
});

// ─── getGoalsWidgetData — widget `goal-progress` (yearly, Fase 10, §5.10) ──

export type GoalsWidgetData = {
  contributedThisMonthCents: string;
  /** Ativas, ordenadas por deadline mais próximo primeiro (sem deadline por último). */
  goals: SerializedGoal[];
  nearestDeadlineGoalId: string | null;
  /** Glide-path da meta mais próxima do prazo; null se nenhuma ativa tem deadline. */
  glidePath: SerializedGlidePathPoint[] | null;
};

/**
 * Widget `goal-progress` (yearly, Fase 10, §5.10/§11). AO CONTRÁRIO de
 * `getNetWorthSeriesForYear` (spec 46) — metas são estado-CORRENTE (progresso/ritmo
 * refletem "agora"), não year-scoped; por isso esta função NÃO recebe `year`. O widget
 * mora no dashboard yearly só como SUPERFÍCIE (§2.5 — "opt-in, sem config por-instância");
 * o dado em si independe do ano exibido. `goals` vem ordenado por deadline mais próximo
 * primeiro — §5.10 `compact` usa os 3 primeiros, `default` usa a lista inteira.
 */
export const getGoalsWidgetData = cache(async function getGoalsWidgetData(
  accountId: string,
): Promise<GoalsWidgetData> {
  const monthStartDay = await monthStartDayOf(accountId);
  const currentFiscal = getCurrentFiscalMonth(new Date(), monthStartDay);
  const goals = await fetchActiveGoalsWithContributions(accountId);

  const aggregate = computeGoalsOverview(goals, currentFiscal, monthStartDay);

  // "Top por deadline" (§5.10): mais próximo primeiro; sem deadline vai por último.
  const sorted = [...goals].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const nearestId = aggregate.nextDeadlineGoal?.id ?? null;
  const nearest = nearestId ? sorted.find((g) => g.id === nearestId) : undefined;

  let glidePath: SerializedGlidePathPoint[] | null = null;
  if (nearest) {
    const { pace } = computeGoalMetrics(nearest, currentFiscal, monthStartDay);
    const { startMonth, endMonth } = resolveGlidePathRange(
      nearest,
      nearest.contributions,
      pace.projectedMonth,
      currentFiscal,
      monthStartDay,
    );
    glidePath = serializeGlidePath(
      buildGlidePath({
        targetCents: nearest.targetCents,
        deadline: nearest.deadline,
        startMonth,
        endMonth,
        contributions: nearest.contributions,
        monthStartDay,
      }),
    );
  }

  return {
    contributedThisMonthCents: aggregate.contributedThisMonthCents.toString(),
    goals: sorted.map((g) => {
      const { progress, pace } = computeGoalMetrics(g, currentFiscal, monthStartDay);
      return toSerializedGoal(g, progress, pace);
    }),
    nearestDeadlineGoalId: nearestId,
    glidePath,
  };
});

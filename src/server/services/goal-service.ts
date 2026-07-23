import { ConflictError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { Prisma } from "@prisma/client";
import { getCurrentFiscalMonth, getMonthRange } from "@/lib/dates";
import type {
  CreateGoalInput,
  UpdateGoalInput,
  DeleteGoalInput,
  ArchiveGoalInput,
  AddContributionInput,
  DeleteContributionInput,
  LinkSuggestedContributionInput,
} from "@/lib/schemas/goal";

const log = logger.child({ module: "goal-service" });

// ─────────────────────────────────────────────────────────────────────────
// I/O — multi-tenancy por re-fetch (espelha balance-account-service.ts)
// ─────────────────────────────────────────────────────────────────────────

async function assertGoalOwned(id: string, ctx: ActionContext) {
  const row = await prisma.goal.findUnique({ where: { id }, select: { accountId: true } });
  if (!row || row.accountId !== ctx.accountId) throw new NotFoundError("Meta");
}

/** Como assertGoalOwned, mas retorna targetCents — evita um 2º roundtrip em addContribution. */
async function getOwnedGoal(id: string, ctx: ActionContext) {
  const row = await prisma.goal.findUnique({
    where: { id },
    select: { accountId: true, targetCents: true },
  });
  if (!row || row.accountId !== ctx.accountId) throw new NotFoundError("Meta");
  return row;
}

/**
 * IDOR guard (GOAL-01/GOAL-02, spec 47 §7): sectionId/categoryId, quando presentes no
 * body, precisam pertencer à account do ctx — espelha o padrão de `memberUserId` em
 * budget-service.ts. Chamar em createGoal/updateGoal antes de qualquer escrita.
 */
async function assertSectionAndCategoryOwned(
  sectionId: string | null | undefined,
  categoryId: string | null | undefined,
  ctx: ActionContext,
) {
  if (sectionId) {
    const section = await prisma.section.findFirst({
      where: { id: sectionId, accountId: ctx.accountId },
      select: { id: true },
    });
    if (!section) throw new NotFoundError("Seção");
  }
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, accountId: ctx.accountId },
      select: { id: true },
    });
    if (!category) throw new NotFoundError("Categoria");
  }
}

/**
 * Recomputa isAchieved (DD-06): Σ contribuições ≥ targetCents. Recebe `trx` (o client da
 * transação interativa que também grava a escrita relacionada) em vez do `prisma` global —
 * atomicidade da leitura do agregado + escrita de isAchieved (ver addContribution /
 * deleteContribution / updateGoal). Resíduo aceito: READ COMMITTED (default do Postgres)
 * não bloqueia contra uma 2ª transação lendo/escrevendo o mesmo goalId no meio da nossa —
 * um lost-update ainda é teoricamente possível sob concorrência alta. Aceitável porque
 * isAchieved é uma flag derivada de baixa frequência (poucos aportes por dia por meta) e é
 * sempre recomputada do zero a partir do Σ completo na escrita seguinte — nunca acumula
 * drift permanente, no pior caso fica momentaneamente desatualizada até o próximo aporte.
 */
async function computeIsAchieved(
  trx: Prisma.TransactionClient,
  goalId: string,
  targetCents: bigint,
): Promise<boolean> {
  const agg = await trx.goalContribution.aggregate({
    where: { goalId },
    _sum: { amountCents: true },
  });
  const progressCents = agg._sum.amountCents ?? 0n;
  return progressCents >= targetCents;
}

/**
 * Guard anti-duplicação (C2, fix wave spec 47): uma transação vale como aporte de,
 * no máximo, UMA meta — compartilhado entre `addContribution` (quando recebe
 * `transactionId` no body) e `linkTransactionAsContribution` (fluxo de sugestão,
 * §5.6/GOAL-05). Antes da extração, só `linkTransactionAsContribution` tinha este
 * guard; `addContribution` chamado direto com um `transactionId` já vinculado
 * dobrava a contagem do aporte sem erro nenhum. Recebe `trx` (não o `prisma`
 * global) e é chamado DE DENTRO da transação interativa de cada caller — mesma
 * lógica de atomicidade documentada em `computeIsAchieved` (a checagem e o
 * `create` que ela protege precisam do mesmo snapshot).
 */
async function assertTransactionNotLinked(
  transactionId: string,
  accountId: string,
  trx: Prisma.TransactionClient,
): Promise<void> {
  const alreadyLinked = await trx.goalContribution.findFirst({
    where: { accountId, transactionId },
    select: { id: true },
  });
  if (alreadyLinked) {
    throw new ConflictError("Esta transação já foi vinculada a um aporte.");
  }
}

export async function createGoal(input: CreateGoalInput, ctx: ActionContext) {
  await assertSectionAndCategoryOwned(input.sectionId, input.categoryId, ctx);

  const created = await prisma.goal.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      targetCents: input.targetCents,
      deadline: input.deadline ?? null,
      sectionId: input.sectionId ?? null,
      categoryId: input.categoryId ?? null,
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  log.info({ goalId: created.id, accountId: ctx.accountId }, "Goal created");
  return { goalId: created.id };
}

export async function updateGoal(input: UpdateGoalInput, ctx: ActionContext) {
  await assertGoalOwned(input.goalId, ctx);
  await assertSectionAndCategoryOwned(input.sectionId, input.categoryId, ctx);

  // Transação interativa (atomicidade — ver nota em computeIsAchieved): o aggregate que
  // recomputa isAchieved e o update que persiste (alvo + isAchieved) precisam do mesmo
  // snapshot, senão um addContribution/deleteContribution concorrente entre as duas
  // chamadas faria este update sobrescrever isAchieved com um valor já obsoleto.
  const isAchieved = await prisma.$transaction(async (trx) => {
    // DD-06: alvo pode mudar (para cima ou para baixo) — isAchieved sempre recomputado.
    const achieved = await computeIsAchieved(trx, input.goalId, input.targetCents);

    await trx.goal.update({
      where: { id: input.goalId },
      data: {
        name: input.name,
        targetCents: input.targetCents,
        deadline: input.deadline ?? null,
        sectionId: input.sectionId ?? null,
        categoryId: input.categoryId ?? null,
        isAchieved: achieved,
      },
    });

    return achieved;
  });

  log.info({ goalId: input.goalId, accountId: ctx.accountId, isAchieved }, "Goal updated");
}

export async function deleteGoal(input: DeleteGoalInput, ctx: ActionContext) {
  await assertGoalOwned(input.goalId, ctx);
  await prisma.goal.delete({ where: { id: input.goalId } }); // cascade nas contribuições
  log.info({ goalId: input.goalId, accountId: ctx.accountId }, "Goal deleted");
}

export async function archiveGoal(input: ArchiveGoalInput, ctx: ActionContext) {
  await assertGoalOwned(input.goalId, ctx);
  await prisma.goal.update({
    where: { id: input.goalId },
    data: { archivedAt: input.archived ? new Date() : null }, // DD-02: null = ativa
  });
  log.info(
    { goalId: input.goalId, accountId: ctx.accountId, archived: input.archived },
    "Goal archive toggled",
  );
}

export async function addContribution(input: AddContributionInput, ctx: ActionContext) {
  const goal = await getOwnedGoal(input.goalId, ctx);

  // GOAL-03/§7: transactionId e responsiblePartyId são IDOR-sensíveis — validar por account.
  // Quando há transactionId, responsiblePartyId é SEMPRE herdado da transação (nunca do body).
  let responsiblePartyId: string | null = null;
  if (input.transactionId) {
    const tx = await prisma.transaction.findUnique({
      where: { id: input.transactionId },
      select: { accountId: true, responsiblePartyId: true },
    });
    if (!tx || tx.accountId !== ctx.accountId) throw new NotFoundError("Transação");
    responsiblePartyId = tx.responsiblePartyId;
  } else if (input.responsiblePartyId) {
    const party = await prisma.responsibleParty.findUnique({
      where: { id: input.responsiblePartyId },
      select: { accountId: true },
    });
    if (!party || party.accountId !== ctx.accountId) throw new NotFoundError("Responsável");
    responsiblePartyId = input.responsiblePartyId;
  }

  // Transação interativa (atomicidade — ver nota em computeIsAchieved): create + aggregate
  // + update(isAchieved) precisam do mesmo snapshot, senão um aporte concorrente entre o
  // create e o aggregate faria o recompute perder a própria escrita deste aporte (ou a de
  // outro, em voo ao mesmo tempo).
  const { contributionId, isAchieved } = await prisma.$transaction(async (trx) => {
    // C2 (fix wave): mesmo guard de linkTransactionAsContribution — um transactionId
    // já vinculado a outro aporte (desta ou de outra meta) é rejeitado aqui também.
    if (input.transactionId) {
      await assertTransactionNotLinked(input.transactionId, ctx.accountId, trx);
    }

    const created = await trx.goalContribution.create({
      data: {
        accountId: ctx.accountId,
        goalId: input.goalId,
        amountCents: input.amountCents,
        contributedOn: input.contributedOn,
        byUserId: ctx.userId, // GOAL-03/§7: SEMPRE o usuário autenticado, nunca do body
        responsiblePartyId,
        transactionId: input.transactionId ?? null,
        notes: input.notes ?? null,
      },
      select: { id: true },
    });

    const achieved = await computeIsAchieved(trx, input.goalId, goal.targetCents);
    await trx.goal.update({ where: { id: input.goalId }, data: { isAchieved: achieved } });

    return { contributionId: created.id, isAchieved: achieved };
  });

  log.info(
    { contributionId, goalId: input.goalId, accountId: ctx.accountId, isAchieved },
    "Goal contribution added",
  );
  return { contributionId };
}

export async function deleteContribution(input: DeleteContributionInput, ctx: ActionContext) {
  const contribution = await prisma.goalContribution.findUnique({
    where: { id: input.contributionId },
    select: { accountId: true, goalId: true, goal: { select: { targetCents: true } } },
  });
  if (!contribution || contribution.accountId !== ctx.accountId) throw new NotFoundError("Aporte");

  // Transação interativa (atomicidade — ver nota em computeIsAchieved): delete + aggregate
  // + update(isAchieved) precisam do mesmo snapshot, senão um aporte concorrente inserido
  // entre o delete e o aggregate seria capturado pelo recompute mas perdido no update.
  const isAchieved = await prisma.$transaction(async (trx) => {
    await trx.goalContribution.delete({ where: { id: input.contributionId } });

    // DD-06: exclusão pode derrubar isAchieved de volta para false.
    const achieved = await computeIsAchieved(
      trx,
      contribution.goalId,
      contribution.goal.targetCents,
    );
    await trx.goal.update({ where: { id: contribution.goalId }, data: { isAchieved: achieved } });
    return achieved;
  });

  log.info(
    {
      contributionId: input.contributionId,
      goalId: contribution.goalId,
      accountId: ctx.accountId,
      isAchieved,
    },
    "Goal contribution deleted",
  );
}

/**
 * Vincular sugerido (GOAL-05, §5.6/§7/§11): confirma como aporte uma transação sugerida
 * (`getGoalSuggestions`, `queries/goals.ts`). Toda a informação do aporte vem da própria
 * transação — nada do body além de `goalId`/`transactionId` (ver linkSuggestedContributionSchema).
 */
export async function linkTransactionAsContribution(
  input: LinkSuggestedContributionInput,
  ctx: ActionContext,
) {
  const goal = await getOwnedGoal(input.goalId, ctx);

  // IDOR (§7): a transação precisa ser da mesma account do ctx.
  const tx = await prisma.transaction.findUnique({
    where: { id: input.transactionId },
    select: { accountId: true, amountCents: true, occurredOn: true, responsiblePartyId: true },
  });
  if (!tx || tx.accountId !== ctx.accountId) throw new NotFoundError("Transação");

  // abs (defensivo — DD-07/§3.4): a sugestão já filtra amountCents > 0 (magnitude =
  // "gasto positivo", convenção do repo), mas o vínculo aqui não confia nisso de novo.
  const amountCents = tx.amountCents < 0n ? -tx.amountCents : tx.amountCents;

  // Transação interativa (atomicidade — ver nota em computeIsAchieved): mesmo padrão de
  // addContribution — create + aggregate + update(isAchieved) precisam do mesmo snapshot.
  const { contributionId, isAchieved } = await prisma.$transaction(async (trx) => {
    // Guard anti-duplicação (C2 — helper compartilhado com addContribution):
    // `getGoalSuggestions` já filtra `goalContributions: { none: {} }` (não sugere
    // transações já vinculadas), mas essa filtragem acontece na LEITURA que popula
    // a UI — uma UI stale ou um double-click pode reenviar o mesmo transactionId
    // antes do próximo refresh. Sem este guard, a mesma transação criaria 2 aportes
    // (dobro). Não é escopado por goalId: uma transação vale como aporte de, no
    // máximo, UMA meta.
    await assertTransactionNotLinked(input.transactionId, ctx.accountId, trx);

    const created = await trx.goalContribution.create({
      data: {
        accountId: ctx.accountId,
        goalId: input.goalId,
        amountCents,
        contributedOn: tx.occurredOn,
        byUserId: ctx.userId, // GOAL-03/§7: SEMPRE o usuário autenticado, nunca do body
        responsiblePartyId: tx.responsiblePartyId, // herdado da transação (§5.6/§7)
        transactionId: input.transactionId,
        notes: null,
      },
      select: { id: true },
    });

    const achieved = await computeIsAchieved(trx, input.goalId, goal.targetCents);
    await trx.goal.update({ where: { id: input.goalId }, data: { isAchieved: achieved } });

    return { contributionId: created.id, isAchieved: achieved };
  });

  log.info(
    {
      contributionId,
      goalId: input.goalId,
      transactionId: input.transactionId,
      accountId: ctx.accountId,
      isAchieved,
    },
    "Goal contribution linked from suggested transaction",
  );
  return { contributionId };
}

// ─────────────────────────────────────────────────────────────────────────
// Cálculo puro (sem Prisma, sem `new Date()`) — espelha net-worth-service.ts.
// Datas/mês fiscal sempre recebidos como parâmetro pelo caller (queries/goals.ts).
// ─────────────────────────────────────────────────────────────────────────

export type GoalContributionLike = { amountCents: bigint; contributedOn: Date };

export type FiscalMonth = { year: number; month: number };

/**
 * Teto de horizonte (fix wave B1, spec 47): sem isto, uma meta com alvo grande e
 * aporte médio minúsculo produz um `monthsToComplete`/`projectedMonth` na casa de
 * ~200k meses — `buildGlidePath` serializaria ~200k pontos e travaria browser/server
 * (payload gigante, render de chart inviável). 120 meses (10 anos) é folga generosa
 * pra qualquer meta realista continuar com projeção útil, sem permitir a série
 * "explodir". Usado tanto para clampar `projectedMonth` (`computePace`, abaixo)
 * quanto o fim do glide-path (`resolveGlidePathRange`, queries/goals.ts).
 */
export const MAX_HORIZON_MONTHS = 120;

function fiscalIndex(f: FiscalMonth): number {
  return f.year * 12 + f.month;
}

/** Nº de meses fiscais de `a` até `b` (pode ser negativo se `b` for anterior a `a`). */
function fiscalMonthsBetween(a: FiscalMonth, b: FiscalMonth): number {
  return fiscalIndex(b) - fiscalIndex(a);
}

/** Soma (ou subtrai, `n` negativo) `n` meses fiscais a um `FiscalMonth`. Exportada
 * para `resolveGlidePathRange` (queries/goals.ts) compor o teto de horizonte (B1). */
export function addFiscalMonths(f: FiscalMonth, n: number): FiscalMonth {
  const total = f.year * 12 + (f.month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/**
 * Maior dos dois meses fiscais (empate → `a`). Usado por `resolveGlidePathRange`
 * (queries/goals.ts) para estender o fim do glide-path até HOJE quando o prazo já
 * venceu (§4.4 refinamento, Fase 9) — a linha real não pode "sumir" no deadline só
 * porque a meta está atrasada; ela precisa mostrar os aportes feitos depois dele.
 */
export function maxFiscalMonth(a: FiscalMonth, b: FiscalMonth): FiscalMonth {
  return fiscalIndex(a) >= fiscalIndex(b) ? a : b;
}

/**
 * Menor dos dois meses fiscais (empate → `a`) — espelha `maxFiscalMonth` acima.
 * Usado por `resolveGlidePathRange` (queries/goals.ts, B1) para clampar o fim do
 * glide-path a `MAX_HORIZON_MONTHS` a partir do início, mesmo com deadline distante.
 */
export function minFiscalMonth(a: FiscalMonth, b: FiscalMonth): FiscalMonth {
  return fiscalIndex(a) <= fiscalIndex(b) ? a : b;
}

// ─── 4.1 Progresso e conclusão ─────────────────────────────────────────────

export type ProgressResult = {
  progressCents: bigint;
  remainingCents: bigint;
  /** Percentual REAL (pode passar de 100 em over-aporte, DD-05) — a barra satura na UI, não aqui. */
  percent: number;
  isAchieved: boolean;
};

export function computeProgress(
  targetCents: bigint,
  contributions: GoalContributionLike[],
): ProgressResult {
  let progressCents = 0n;
  for (const c of contributions) progressCents += c.amountCents;

  const isAchieved = progressCents >= targetCents;
  const remainingCents = isAchieved ? 0n : targetCents - progressCents;
  const percent = targetCents > 0n ? (Number(progressCents) / Number(targetCents)) * 100 : 0;

  return { progressCents, remainingCents, percent, isAchieved };
}

// ─── 4.2 / 4.3 Ritmo, aporte mensal necessário e projeção ──────────────────

export type Pace = "achieved" | "on_track" | "ahead" | "behind" | "no_contribution";

export type PaceResult = {
  pace: Pace;
  /** §4.2 — null quando a meta não tem deadline (não existe "aporte necessário" sem prazo). */
  requiredMonthlyCents: bigint | null;
  /** §4.3 — null quando não há nenhuma contribuição (sem ritmo pra projetar). */
  projectedMonth: FiscalMonth | null;
};

/**
 * Ritmo (§4.3) + aporte mensal necessário (§4.2). `currentFiscal` é o mês fiscal
 * corrente já resolvido pelo caller (`getCurrentFiscalMonth(new Date(), monthStartDay)`)
 * — esta função nunca lê o relógio. `deadline`/`contributedOn` (Dates) são convertidos
 * para mês fiscal via `getCurrentFiscalMonth`, que é determinística em qualquer data
 * recebida (o nome "current" refere-se ao uso mais comum, não a uma leitura de relógio).
 */
export function computePace(params: {
  targetCents: bigint;
  deadline: Date | null;
  contributions: GoalContributionLike[];
  currentFiscal: FiscalMonth;
  monthStartDay: number;
}): PaceResult {
  const { targetCents, deadline, contributions, currentFiscal, monthStartDay } = params;
  const { progressCents, remainingCents, isAchieved } = computeProgress(targetCents, contributions);

  // §4.2 — aporte mensal necessário (só com deadline)
  let requiredMonthlyCents: bigint | null = null;
  if (deadline) {
    const deadlineFiscal = getCurrentFiscalMonth(deadline, monthStartDay);
    const monthsToDeadline = Math.max(1, fiscalMonthsBetween(currentFiscal, deadlineFiscal));
    requiredMonthlyCents =
      remainingCents > 0n ? BigInt(Math.round(Number(remainingCents) / monthsToDeadline)) : 0n;
  }

  // §4.3 — média mensal desde o 1º aporte + projeção de conclusão no ritmo atual
  let avgMonthlyCents = 0n;
  let projectedMonth: FiscalMonth | null = null;
  if (progressCents > 0n) {
    let firstContributedOn = contributions[0].contributedOn;
    for (const c of contributions) {
      if (c.contributedOn < firstContributedOn) firstContributedOn = c.contributedOn;
    }
    const firstFiscal = getCurrentFiscalMonth(firstContributedOn, monthStartDay);
    const elapsed = Math.max(1, fiscalMonthsBetween(firstFiscal, currentFiscal) + 1);
    avgMonthlyCents = BigInt(Math.round(Number(progressCents) / elapsed));
    if (avgMonthlyCents > 0n) {
      // B1 (fix wave): clampado a MAX_HORIZON_MONTHS — um aporte médio minúsculo
      // frente a um alvo grande faria este `ceil` disparar pra dezenas de milhares
      // de meses; `projectedMonth` nunca deve ficar além de currentFiscal + teto.
      const monthsToComplete = Math.min(
        Math.ceil(Number(remainingCents) / Number(avgMonthlyCents)),
        MAX_HORIZON_MONTHS,
      );
      projectedMonth = addFiscalMonths(currentFiscal, monthsToComplete);
    }
  }

  // §4.3 — badge de ritmo
  let pace: Pace;
  if (isAchieved) {
    pace = "achieved";
  } else if (progressCents === 0n) {
    pace = "no_contribution";
  } else if (!deadline) {
    pace = "on_track";
  } else {
    const deadlineFiscal = getCurrentFiscalMonth(deadline, monthStartDay);
    const withinDeadline =
      projectedMonth !== null && fiscalIndex(projectedMonth) <= fiscalIndex(deadlineFiscal);
    if (withinDeadline) {
      // Comparação de RITMO (não é valor monetário persistido) — Number-space é seguro
      // e evita o truncamento de `bigint / bigint` (skill money-handling).
      const requiredNum = Number(requiredMonthlyCents ?? 0n);
      const avgNum = Number(avgMonthlyCents);
      pace = avgNum > requiredNum * 1.05 ? "ahead" : "on_track";
    } else {
      pace = "behind";
    }
  }

  return { pace, requiredMonthlyCents, projectedMonth };
}

// ─── 4.4 Glide-path ─────────────────────────────────────────────────────────

export type GlidePathPoint = {
  year: number;
  month: number;
  cumulativeCents: bigint;
  /** null se a meta não tem deadline (§4.4 — linha ideal só existe com prazo). */
  idealCents: bigint | null;
  targetCents: bigint;
};

/**
 * Série mensal do glide-path (§4.4): acúmulo real (cumulativo das contribuições,
 * carry-forward mensal — espelha `buildMonthlySeries` de net-worth-service.ts) vs.
 * linha ideal (linear de 0 no início ao alvo no deadline) vs. alvo constante.
 * `startMonth`/`endMonth` já resolvidos pelo caller (ex.: início = Goal.createdAt em
 * mês fiscal; fim = deadline em mês fiscal OU a `projectedMonth` de computePace OU o
 * mês fiscal corrente, na ausência de ambos) — esta função nunca lê o relógio.
 */
export function buildGlidePath(params: {
  targetCents: bigint;
  deadline: Date | null;
  startMonth: FiscalMonth;
  endMonth: FiscalMonth;
  contributions: GoalContributionLike[];
  monthStartDay: number;
}): GlidePathPoint[] {
  const { targetCents, deadline, startMonth, endMonth, contributions, monthStartDay } = params;

  const sorted = [...contributions].sort(
    (a, b) => a.contributedOn.getTime() - b.contributedOn.getTime(),
  );

  const deadlineFiscal = deadline ? getCurrentFiscalMonth(deadline, monthStartDay) : null;
  const totalIdealMonths = deadlineFiscal ? fiscalMonthsBetween(startMonth, deadlineFiscal) : 0;

  const totalMonths = Math.max(0, fiscalMonthsBetween(startMonth, endMonth));
  const points: GlidePathPoint[] = [];
  let idx = 0;
  let running = 0n;

  for (let i = 0; i <= totalMonths; i++) {
    const point = addFiscalMonths(startMonth, i);
    const { end } = getMonthRange(point.year, point.month, monthStartDay);

    // contribuições ordenadas + ponteiro único: soma cumulativa (carry-forward) sem re-varrer.
    while (idx < sorted.length && sorted[idx].contributedOn <= end) {
      running += sorted[idx].amountCents;
      idx++;
    }

    let idealCents: bigint | null = null;
    if (deadlineFiscal) {
      if (totalIdealMonths <= 0) {
        idealCents = targetCents; // deadline no mesmo mês (ou antes) do início → alvo imediato
      } else if (i <= totalIdealMonths) {
        idealCents = BigInt(Math.round((Number(targetCents) * i) / totalIdealMonths));
      }
      // i > totalIdealMonths: ponto além do deadline (endMonth estendido pela linha real
      // até hoje, prazo vencido — ver resolveGlidePathRange). A linha ideal NÃO continua
      // "flat" no alvo depois do prazo; ela some (idealCents fica null) — ela é ancorada
      // 0→alvo só até o deadline, não uma projeção indefinida.
    }

    points.push({
      year: point.year,
      month: point.month,
      cumulativeCents: running,
      idealCents,
      targetCents,
    });
  }

  return points;
}

// ─── 4.5 Split por membro ───────────────────────────────────────────────────

export type MemberSplitEntry = {
  userId: string;
  userName: string;
  totalCents: bigint;
  percent: number;
};

/**
 * Split por membro (§4.5): Σ amountCents agrupado por byUserId (não por persona — §3.1).
 * `userNames` resolvido pelo caller (relação `byUser`). Ordenado por maior contribuição.
 */
export function computeMemberSplit(
  contributions: { byUserId: string; amountCents: bigint }[],
  userNames: Map<string, string>,
): MemberSplitEntry[] {
  const totals = new Map<string, bigint>();
  for (const c of contributions) {
    totals.set(c.byUserId, (totals.get(c.byUserId) ?? 0n) + c.amountCents);
  }
  const grandTotal = [...totals.values()].reduce((sum, v) => sum + v, 0n);

  return [...totals.entries()]
    .map(([userId, totalCents]) => ({
      userId,
      userName: userNames.get(userId) ?? userId,
      totalCents,
      percent: grandTotal > 0n ? (Number(totalCents) / Number(grandTotal)) * 100 : 0,
    }))
    .sort((a, b) => (a.totalCents < b.totalCents ? 1 : a.totalCents > b.totalCents ? -1 : 0));
}

// ─── 4.6 Agregado da aba Metas ──────────────────────────────────────────────

export type GoalWithContributions = {
  id: string;
  targetCents: bigint;
  deadline: Date | null;
  archivedAt: Date | null;
  contributions: GoalContributionLike[];
};

export type GoalsOverviewResult = {
  totalSavedCents: bigint;
  totalTargetCents: bigint;
  contributedThisMonthCents: bigint;
  nextDeadlineGoal: { id: string; deadline: Date } | null;
  counts: { onTrack: number; behind: number; achieved: number; noContribution: number };
};

/**
 * Agregado da aba Metas (§4.6) — filtra internamente metas arquivadas (espelha o
 * `if (a.archivedAt !== null) continue` de `computeCurrentNetWorth`), então o caller
 * pode passar TODAS as metas da account sem pré-filtrar.
 *
 * `counts` distingue 4 baldes (os 4 reconciliam com o total de metas ativas, §4.6
 * atualizada): `achieved` e `behind` mapeiam 1:1; `on_track`/`ahead` caem em `onTrack`
 * (nenhuma delas é "atrasada"); `no_contribution` (meta ainda sem nenhum aporte) tem
 * balde próprio (`noContribution`) — não é "no prazo" nem "atrasada", é uma meta ainda
 * não iniciada, e a UI do hero (§5.2) exibe esse balde como um 4º badge condicional.
 */
export function computeGoalsOverview(
  goals: GoalWithContributions[],
  currentFiscal: FiscalMonth,
  monthStartDay: number,
): GoalsOverviewResult {
  const active = goals.filter((g) => g.archivedAt === null);
  const { start, end } = getMonthRange(currentFiscal.year, currentFiscal.month, monthStartDay);

  let totalSavedCents = 0n;
  let totalTargetCents = 0n;
  let contributedThisMonthCents = 0n;
  const counts = { onTrack: 0, behind: 0, achieved: 0, noContribution: 0 };
  let nextDeadlineGoal: { id: string; deadline: Date } | null = null;

  for (const g of active) {
    const progress = computeProgress(g.targetCents, g.contributions);
    const { pace } = computePace({
      targetCents: g.targetCents,
      deadline: g.deadline,
      contributions: g.contributions,
      currentFiscal,
      monthStartDay,
    });

    totalSavedCents += progress.progressCents;
    totalTargetCents += g.targetCents;

    if (pace === "achieved") counts.achieved++;
    else if (pace === "behind") counts.behind++;
    else if (pace === "on_track" || pace === "ahead") counts.onTrack++;
    else counts.noContribution++; // "no_contribution": meta ainda não iniciada.

    if (
      !progress.isAchieved &&
      g.deadline &&
      (!nextDeadlineGoal || g.deadline < nextDeadlineGoal.deadline)
    ) {
      nextDeadlineGoal = { id: g.id, deadline: g.deadline };
    }

    for (const c of g.contributions) {
      if (c.contributedOn >= start && c.contributedOn <= end) {
        contributedThisMonthCents += c.amountCents;
      }
    }
  }

  return { totalSavedCents, totalTargetCents, contributedThisMonthCents, nextDeadlineGoal, counts };
}

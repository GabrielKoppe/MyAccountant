import { NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { Prisma } from "@prisma/client";
import type { CreateBudgetInput, UpdateBudgetInput, DeleteBudgetInput } from "@/lib/schemas/budget";
import { budgetDimensionWhere } from "@/server/queries/budgets";

const log = logger.child({ module: "budget-service" });

/**
 * Multi-tenancy / anti-IDOR (CLAUDE.md §5.2): valida que TODOS os ids de CADA dimensão
 * pertencem à account antes de gravar. Seções/categorias/instituições/tipos de tabela
 * têm coluna `accountId`. A dimensão "responsável" (`memberUserIds`) é validada contra as
 * `responsibleParty`s da account (novo: partyId de qualquer kind) COM tolerância a `userId`
 * de membro legado (via `AccountMember`) — budgets salvos antes da unificação guardavam
 * userIds. Um id inexistente ou de outra account derruba a operação com NotFoundError (nunca
 * vaza/associa entre tenants). Dimensão vazia = nada a validar.
 */
async function validateDimensions(
  input: Pick<
    CreateBudgetInput,
    "sectionIds" | "categoryIds" | "memberUserIds" | "institutionIds" | "tableTypeIds"
  >,
  accountId: string,
): Promise<void> {
  const checks: { ids: string[]; count: () => Promise<number>; label: string }[] = [
    {
      ids: input.sectionIds,
      label: "Seção",
      count: () =>
        prisma.section.count({ where: { accountId, id: { in: input.sectionIds } } }),
    },
    {
      ids: input.categoryIds,
      label: "Categoria",
      count: () =>
        prisma.category.count({ where: { accountId, id: { in: input.categoryIds } } }),
    },
    {
      ids: input.institutionIds,
      label: "Instituição",
      count: () =>
        prisma.institution.count({ where: { accountId, id: { in: input.institutionIds } } }),
    },
    {
      ids: input.tableTypeIds,
      label: "Tipo de tabela",
      count: () =>
        prisma.tableType.count({ where: { accountId, id: { in: input.tableTypeIds } } }),
    },
  ];

  for (const check of checks) {
    if (check.ids.length === 0) continue;
    const found = await check.count();
    if (found !== check.ids.length) throw new NotFoundError(check.label);
  }

  // Dimensão "responsável": cada id é válido se for uma `responsibleParty` da account
  // (novo: partyId) OU um `userId` de membro da account (legado). Só a união satisfaz —
  // portanto um count por tabela não basta: coletamos os ids válidos das duas fontes e
  // exigimos que TODOS os ids pedidos estejam cobertos (multi-tenancy: só a própria account).
  if (input.memberUserIds.length > 0) {
    const [parties, memberLinks] = await Promise.all([
      prisma.responsibleParty.findMany({
        where: { accountId, id: { in: input.memberUserIds } },
        select: { id: true },
      }),
      prisma.accountMember.findMany({
        where: { accountId, userId: { in: input.memberUserIds } },
        select: { userId: true },
      }),
    ]);
    const valid = new Set<string>();
    parties.forEach((p) => valid.add(p.id));
    memberLinks.forEach((m) => valid.add(m.userId));
    if (input.memberUserIds.some((id) => !valid.has(id))) throw new NotFoundError("Responsável");
  }
}

function dimensionData(input: CreateBudgetInput) {
  return {
    sectionIds: input.sectionIds,
    categoryIds: input.categoryIds,
    memberUserIds: input.memberUserIds,
    institutionIds: input.institutionIds,
    tableTypeIds: input.tableTypeIds,
  };
}

export async function createBudget(input: CreateBudgetInput, ctx: ActionContext) {
  await validateDimensions(input, ctx.accountId);

  const budget = await prisma.budget.create({
    data: {
      accountId: ctx.accountId,
      name: input.name ?? null,
      ...dimensionData(input),
      amountCents: input.amountCents,
      alertThresholdPercent: input.alertThresholdPercent,
      isRecurring: input.isRecurring,
      showInSummary: input.showInSummary,
      year: input.isRecurring ? null : (input.year ?? null),
      month: input.isRecurring ? null : (input.month ?? null),
    },
    select: { id: true },
  });

  log.info({ budgetId: budget.id, accountId: ctx.accountId }, "Budget created");
  return { budgetId: budget.id };
}

export async function updateBudget(input: UpdateBudgetInput, ctx: ActionContext) {
  const existing = await prisma.budget.findUnique({
    where: { id: input.budgetId },
    select: { accountId: true },
  });
  if (!existing || existing.accountId !== ctx.accountId) throw new NotFoundError("Orçamento");

  await validateDimensions(input, ctx.accountId);

  await prisma.budget.update({
    where: { id: input.budgetId },
    data: {
      name: input.name ?? null,
      ...dimensionData(input),
      amountCents: input.amountCents,
      alertThresholdPercent: input.alertThresholdPercent,
      isRecurring: input.isRecurring,
      showInSummary: input.showInSummary,
      year: input.isRecurring ? null : (input.year ?? null),
      month: input.isRecurring ? null : (input.month ?? null),
    },
  });

  log.info({ budgetId: input.budgetId, accountId: ctx.accountId }, "Budget updated");
}

export async function deleteBudget(input: DeleteBudgetInput, ctx: ActionContext) {
  const existing = await prisma.budget.findUnique({
    where: { id: input.budgetId },
    select: { accountId: true },
  });
  if (!existing || existing.accountId !== ctx.accountId) throw new NotFoundError("Orçamento");

  await prisma.budget.delete({ where: { id: input.budgetId } });

  log.info({ budgetId: input.budgetId, accountId: ctx.accountId }, "Budget deleted");
}

// ─── Budget Transaction Details ───────────────────────────────────────────────

export type BudgetTxRow = {
  id: string;
  description: string | null;
  amountCents: string;
  occurredOn: string;
  categoryName: string | null;
  institutionName: string | null;
};

export type BudgetTxDetail = {
  transactions: BudgetTxRow[];
  categoryBreakdown: { name: string; valueCents: string }[];
};

export async function getBudgetTransactions(
  input: { budgetId: string; monthId: string },
  ctx: ActionContext,
): Promise<BudgetTxDetail> {
  const budget = await prisma.budget.findUnique({
    where: { id: input.budgetId, accountId: ctx.accountId },
    select: {
      sectionIds: true,
      categoryIds: true,
      memberUserIds: true,
      institutionIds: true,
      tableTypeIds: true,
    },
  });
  if (!budget) throw new NotFoundError("Orçamento");

  // Mesmo mapeamento dimensão → transação de calcSpent (queries/budgets.ts) — interseção
  // AND entre dimensões não-vazias, OU dentro via `in`.
  const dimensionWhere = await budgetDimensionWhere(budget, ctx.accountId);
  const where: Prisma.TransactionWhereInput = {
    accountId: ctx.accountId,
    monthId: input.monthId,
    amountCents: { gt: 0n },
    ...dimensionWhere,
  };

  const txs = await prisma.transaction.findMany({
    where,
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      description: true,
      amountCents: true,
      occurredOn: true,
      category: { select: { name: true } },
      institution: { select: { name: true } },
    },
  });

  const rows: BudgetTxRow[] = txs.map((t) => ({
    id: t.id,
    description: t.description,
    amountCents: t.amountCents.toString(),
    occurredOn: t.occurredOn.toISOString().slice(0, 10),
    categoryName: t.category?.name ?? null,
    institutionName: t.institution?.name ?? null,
  }));

  const byCategory = new Map<string, bigint>();
  for (const t of txs) {
    const key = t.category?.name ?? "Sem categoria";
    byCategory.set(key, (byCategory.get(key) ?? 0n) + t.amountCents);
  }
  const categoryBreakdown = [...byCategory.entries()]
    .sort((a, b) => Number(b[1] - a[1]))
    .map(([name, cents]) => ({ name, valueCents: cents.toString() }));

  return { transactions: rows, categoryBreakdown };
}

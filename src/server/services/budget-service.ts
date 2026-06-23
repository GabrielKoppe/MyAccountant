import { NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { Prisma } from "@prisma/client";
import type { CreateBudgetInput, UpdateBudgetInput, DeleteBudgetInput } from "@/lib/schemas/budget";

const log = logger.child({ module: "budget-service" });

export async function createBudget(input: CreateBudgetInput, ctx: ActionContext) {
  if (input.memberUserId) {
    const member = await prisma.accountMember.findUnique({
      where: { accountId_userId: { accountId: ctx.accountId, userId: input.memberUserId } },
    });
    if (!member) throw new NotFoundError("Membro");
  }

  const budget = await prisma.budget.create({
    data: {
      accountId: ctx.accountId,
      name: input.name ?? null,
      sectionId: input.sectionId ?? null,
      categoryId: input.categoryId ?? null,
      memberUserId: input.memberUserId ?? null,
      institutionId: input.institutionId ?? null,
      tableTypeId: input.tableTypeId ?? null,
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
  if (!existing || existing.accountId !== ctx.accountId) throw new NotFoundError("Meta");

  if (input.memberUserId) {
    const member = await prisma.accountMember.findUnique({
      where: { accountId_userId: { accountId: ctx.accountId, userId: input.memberUserId } },
    });
    if (!member) throw new NotFoundError("Membro");
  }

  await prisma.budget.update({
    where: { id: input.budgetId },
    data: {
      name: input.name ?? null,
      sectionId: input.sectionId ?? null,
      categoryId: input.categoryId ?? null,
      memberUserId: input.memberUserId ?? null,
      institutionId: input.institutionId ?? null,
      tableTypeId: input.tableTypeId ?? null,
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
  if (!existing || existing.accountId !== ctx.accountId) throw new NotFoundError("Meta");

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
      sectionId: true,
      categoryId: true,
      memberUserId: true,
      institutionId: true,
      tableTypeId: true,
    },
  });
  if (!budget) throw new NotFoundError("Meta");

  const where: Prisma.TransactionWhereInput = {
    accountId: ctx.accountId,
    monthId: input.monthId,
    amountCents: { gt: 0n },
  };

  if (budget.sectionId) {
    where.sectionId = budget.sectionId;
  } else {
    where.section = { countType: { not: "ignore" } };
  }
  if (budget.categoryId) where.categoryId = budget.categoryId;
  if (budget.memberUserId) where.responsibleUserId = budget.memberUserId;
  if (budget.institutionId) where.institutionId = budget.institutionId;
  if (budget.tableTypeId) where.table = { tableTypeId: budget.tableTypeId };

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

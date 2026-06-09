import { NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
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

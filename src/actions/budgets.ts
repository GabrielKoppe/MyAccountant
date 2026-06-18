"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/server/api/define-action";
import { createBudgetSchema, updateBudgetSchema, deleteBudgetSchema } from "@/lib/schemas/budget";
import * as budgetService from "@/server/services/budget-service";
import { getBudgetsForSettings } from "@/lib/queries/budgets";
import { prisma } from "@/server/prisma";
import type { Prisma } from "@prisma/client";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createBudgetAction = defineAction({
  schema: createBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await budgetService.createBudget(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/budgets`);
    updateTag(`account:${ctx.accountId}`); // invalida cache de insights (metas mudaram)
    return result;
  },
});

export const updateBudgetAction = defineAction({
  schema: updateBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await budgetService.updateBudget(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/budgets`);
    updateTag(`account:${ctx.accountId}`);
  },
});

export const deleteBudgetAction = defineAction({
  schema: deleteBudgetSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await budgetService.deleteBudget(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/budgets`);
    updateTag(`account:${ctx.accountId}`);
  },
});

export const listBudgetsAction = defineAction({
  schema: z.object({}),
  handler: async (_input, ctx) => {
    return getBudgetsForSettings(ctx.accountId);
  },
});

// ─── Budget Transaction Details ───────────────────────────────────────────────

export type BudgetTxRow = {
  id: string;
  description: string | null;
  amountCents: string;
  occurredOn: string; // ISO date
  categoryName: string | null;
  institutionName: string | null;
};

export type BudgetTxDetail = {
  transactions: BudgetTxRow[];
  /** Breakdown por categoria para o gráfico de pizza. */
  categoryBreakdown: { name: string; valueCents: string }[];
};

export const getBudgetTransactionsAction = defineAction({
  schema: z.object({ budgetId: z.string().cuid(), monthId: z.string().cuid() }),
  handler: async ({ budgetId, monthId }, ctx) => {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId, accountId: ctx.accountId },
      select: {
        sectionId: true,
        categoryId: true,
        memberUserId: true,
        institutionId: true,
        tableTypeId: true,
      },
    });
    if (!budget) throw new Error("Budget not found");

    const where: Prisma.TransactionWhereInput = {
      accountId: ctx.accountId,
      monthId,
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

    // Agrupa por categoria para o pie
    const byCategory = new Map<string, bigint>();
    for (const t of txs) {
      const key = t.category?.name ?? "Sem categoria";
      byCategory.set(key, (byCategory.get(key) ?? 0n) + t.amountCents);
    }
    const categoryBreakdown = [...byCategory.entries()]
      .sort((a, b) => Number(b[1] - a[1]))
      .map(([name, cents]) => ({ name, valueCents: cents.toString() }));

    return { transactions: rows, categoryBreakdown } satisfies BudgetTxDetail;
  },
});

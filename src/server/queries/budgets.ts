import { cache } from "react";

import { prisma } from "@/server/prisma";
import { formatCentsToBrl } from "@/lib/money";

// ─── Types ────────────────────────────────────────────────────────

type DimDetail = { id: string; name: string };

export type BudgetWithDetails = {
  id: string;
  name: string | null;
  sectionId: string | null;
  section: DimDetail | null;
  categoryId: string | null;
  category: DimDetail | null;
  memberUserId: string | null;
  member: { id: string; name: string | null } | null;
  institutionId: string | null;
  institution: DimDetail | null;
  tableTypeId: string | null;
  tableType: DimDetail | null;
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

export type BudgetFormOptions = {
  sections: DimDetail[];
  categories: DimDetail[];
  members: { id: string; name: string | null; email: string }[];
  institutions: DimDetail[];
  tableTypes: DimDetail[];
};

// ─── Helpers ──────────────────────────────────────────────────────

export function getBudgetLabel(budget: BudgetWithDetails): string {
  const dims: string[] = [];
  if (budget.section) dims.push(budget.section.name);
  if (budget.category) dims.push(budget.category.name);
  if (budget.member) dims.push(budget.member.name ?? "Membro");
  if (budget.institution) dims.push(budget.institution.name);
  if (budget.tableType) dims.push(budget.tableType.name);

  const dimLabel = dims.join(" · ");
  const valueLabel = `até ${formatCentsToBrl(BigInt(budget.amountCents))}`;
  return budget.name || `${dimLabel} — ${valueLabel}`;
}

const BUDGET_INCLUDE = {
  section: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  member: { select: { id: true, name: true } },
  institution: { select: { id: true, name: true } },
  tableType: { select: { id: true, name: true } },
} as const;

function serializeBudget(b: {
  id: string;
  name: string | null;
  sectionId: string | null;
  section: DimDetail | null;
  categoryId: string | null;
  category: DimDetail | null;
  memberUserId: string | null;
  member: { id: string; name: string | null } | null;
  institutionId: string | null;
  institution: DimDetail | null;
  tableTypeId: string | null;
  tableType: DimDetail | null;
  amountCents: bigint;
  alertThresholdPercent: number;
  isRecurring: boolean;
  showInSummary: boolean;
  year: number | null;
  month: number | null;
}): BudgetWithDetails {
  return {
    ...b,
    amountCents: b.amountCents.toString(),
  };
}

// ─── Queries ──────────────────────────────────────────────────────

export const getBudgetsForSettings = cache(async function getBudgetsForSettings(
  accountId: string,
): Promise<BudgetWithDetails[]> {
  const budgets = await prisma.budget.findMany({
    where: { accountId },
    include: BUDGET_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return budgets.map(serializeBudget);
});

export const getBudgetFormOptions = cache(async function getBudgetFormOptions(
  accountId: string,
): Promise<BudgetFormOptions> {
  const [sections, categories, members, institutions, tableTypes] = await Promise.all([
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
    prisma.accountMember.findMany({
      where: { accountId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
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

  return {
    sections,
    categories,
    members: members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
    institutions,
    tableTypes,
  };
});

export const getBudgetsWithProgress = cache(async function getBudgetsWithProgress(
  accountId: string,
  year: number,
  month: number,
  onlyShowInSummary = false,
): Promise<BudgetProgress[]> {
  const monthRecord = await prisma.month.findUnique({
    where: { accountId_year_month: { accountId, year, month } },
    select: { id: true },
  });
  if (!monthRecord) return [];

  const budgets = await prisma.budget.findMany({
    where: {
      accountId,
      OR: [{ isRecurring: true }, { isRecurring: false, year, month }],
      ...(onlyShowInSummary ? { showInSummary: true } : {}),
    },
    include: BUDGET_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  const results = await Promise.all(
    budgets.map(async (budget) => {
      const spentCents = await calcSpent(budget, accountId, monthRecord.id);
      const targetCents = budget.amountCents > 0n ? budget.amountCents : 1n;
      const percent = Math.round(Number((spentCents * 100n) / targetCents));
      const serialized = serializeBudget(budget);

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

async function calcSpent(
  budget: {
    sectionId: string | null;
    categoryId: string | null;
    memberUserId: string | null;
    institutionId: string | null;
    tableTypeId: string | null;
  },
  accountId: string,
  monthId: string,
): Promise<bigint> {
  const where: Parameters<typeof prisma.transaction.aggregate>[0]["where"] = {
    accountId,
    monthId,
    amountCents: { gt: 0n },
  };

  if (budget.sectionId) {
    where.sectionId = budget.sectionId;
  } else {
    // When not scoped to a specific section, exclude transactions from "ignore" sections
    // so they don't inflate category/member/institution/tableType budgets.
    where.section = { countType: { not: "ignore" } };
  }

  if (budget.categoryId) where.categoryId = budget.categoryId;
  if (budget.memberUserId) where.responsibleUserId = budget.memberUserId;
  if (budget.institutionId) where.institutionId = budget.institutionId;
  if (budget.tableTypeId) where.table = { tableTypeId: budget.tableTypeId };

  const agg = await prisma.transaction.aggregate({ where, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0n;
}

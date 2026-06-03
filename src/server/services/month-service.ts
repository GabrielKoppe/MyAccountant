import type { SectionCountType } from "@prisma/client";

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { CreateMonthInput, DeleteMonthInput } from "@/lib/schemas/months";

const log = logger.child({ module: "month-service" });

export async function createMonth(input: CreateMonthInput, ctx: ActionContext) {
  const existing = await prisma.month.findUnique({
    where: {
      accountId_year_month: {
        accountId: ctx.accountId,
        year: input.year,
        month: input.month,
      },
    },
  });
  if (existing) throw new ConflictError("Este mês já foi criado.");

  const newMonth = await prisma.month.create({
    data: {
      accountId: ctx.accountId,
      year: input.year,
      month: input.month,
      createdById: ctx.userId,
    },
    select: { id: true },
  });

  log.info({ monthId: newMonth.id, accountId: ctx.accountId }, "Month created");
  return { monthId: newMonth.id };
}

export async function deleteMonth(input: DeleteMonthInput, ctx: ActionContext) {
  if (ctx.role !== "owner") throw new ForbiddenError("Apenas proprietários podem deletar meses.");

  const month = await prisma.month.findUnique({
    where: { id: input.monthId },
    select: { accountId: true },
  });
  if (!month || month.accountId !== ctx.accountId) throw new NotFoundError("Mês");

  await prisma.month.delete({ where: { id: input.monthId } });

  log.info({ monthId: input.monthId, accountId: ctx.accountId }, "Month deleted");
}

// ─── Queries para a página do mês ─────────────────────────────────

export async function getMonthSections(accountId: string, monthId: string) {
  const [activeSections, inactiveWithTables] = await Promise.all([
    prisma.section.findMany({
      where: { accountId, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, countType: true, isActive: true, order: true },
    }),
    prisma.section.findMany({
      where: {
        accountId,
        isActive: false,
        tables: { some: { monthId } },
      },
      orderBy: { order: "asc" },
      select: { id: true, name: true, countType: true, isActive: true, order: true },
    }),
  ]);

  return [...activeSections, ...inactiveWithTables];
}

export async function getSectionTotals(
  accountId: string,
  monthId: string,
  sectionIds: string[],
): Promise<Record<string, bigint>> {
  if (sectionIds.length === 0) return {};

  const results = await Promise.all(
    sectionIds.map(async (sectionId) => {
      const agg = await prisma.transaction.aggregate({
        where: {
          accountId,
          monthId,
          sectionId,
          table: { countInMonth: true },
        },
        _sum: { amountCents: true },
      });
      return { sectionId, total: agg._sum.amountCents ?? 0n };
    }),
  );

  return Object.fromEntries(results.map((r) => [r.sectionId, r.total]));
}

export function calculateMonthTotal(
  sections: { id: string; countType: SectionCountType }[],
  sectionTotals: Record<string, bigint>,
): bigint {
  let total = 0n;
  for (const section of sections) {
    const sectionTotal = sectionTotals[section.id] ?? 0n;
    if (section.countType === "add") total += sectionTotal;
    else if (section.countType === "subtract") total -= sectionTotal;
    else if (section.countType === "neutral") total += sectionTotal;
    // "ignore" → não soma
  }
  return total;
}

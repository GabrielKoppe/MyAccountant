import type { SectionCountType } from "@prisma/client";

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { applyDayToMonth } from "@/lib/dates";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { AutoApplyResult, CreateMonthInput, DeleteMonthInput } from "@/lib/schemas/months";
import {
  convertPendingInstallmentsForMonth,
  type InstallmentConvertResult,
} from "./installment-service";

const log = logger.child({ module: "month-service" });

export async function createMonth(
  input: CreateMonthInput,
  ctx: ActionContext,
): Promise<{
  monthId: string;
  autoApplied: AutoApplyResult[];
  installmentsConverted: InstallmentConvertResult;
}> {
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

  const autoApplied = await applyAutoTemplates(newMonth.id, input, ctx);

  const installmentsConverted = await convertPendingInstallmentsForMonth(
    ctx.accountId,
    newMonth.id,
    input.year,
    input.month,
    ctx.userId,
  );

  return { monthId: newMonth.id, autoApplied, installmentsConverted };
}

async function applyAutoTemplates(
  monthId: string,
  input: CreateMonthInput,
  ctx: ActionContext,
): Promise<AutoApplyResult[]> {
  const templates = await prisma.tableTemplate.findMany({
    where: { accountId: ctx.accountId, autoApply: true },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: [{ displayOrder: "asc" }, { day: "asc" }] } },
  });

  if (templates.length === 0) return [];

  const results: AutoApplyResult[] = [];

  for (const template of templates) {
    try {
      if (!template.autoSectionId || !template.autoTableTypeId) {
        throw new Error("Seção ou tipo de tabela não configurados no modelo.");
      }

      const [section, tableType] = await Promise.all([
        prisma.section.findFirst({
          where: { id: template.autoSectionId, accountId: ctx.accountId },
        }),
        prisma.tableType.findFirst({
          where: { id: template.autoTableTypeId, accountId: ctx.accountId },
        }),
      ]);

      if (!section) throw new Error("Seção configurada não foi encontrada.");
      if (!tableType) throw new Error("Tipo de tabela configurado não foi encontrado.");

      await prisma.$transaction(async (tx) => {
        const tableCount = await tx.financeTable.count({
          where: { monthId, sectionId: template.autoSectionId! },
        });

        const table = await tx.financeTable.create({
          data: {
            accountId: ctx.accountId,
            monthId,
            sectionId: template.autoSectionId!,
            tableTypeId: template.autoTableTypeId,
            name: template.name,
            countInMonth: template.countInMonth,
            sourceMethod: "template",
            displayOrder: tableCount,
            createdById: ctx.userId,
          },
        });

        if (template.items.length > 0) {
          await tx.transaction.createMany({
            data: template.items.map((item) => ({
              accountId: ctx.accountId,
              monthId,
              tableId: table.id,
              sectionId: template.autoSectionId!,
              occurredOn: applyDayToMonth(item.day, input.year, input.month),
              amountCents: item.amountCents,
              description: item.description,
              notes: item.notes,
              isPending: item.isPending,
              categoryId: item.categoryId,
              subcategoryId: item.subcategoryId,
              institutionId: item.institutionId,
              responsibleUserId: item.responsibleUserId,
              responsiblePartyId: item.responsiblePartyId,
              cardInstallment: item.cardInstallment,
              investmentType: item.investmentType,
              expenseType: item.expenseType ?? null,
              source: "auto_template",
              createdById: ctx.userId,
              metadata: {},
            })),
          });
        }
      });

      log.info(
        { templateId: template.id, monthId, items: template.items.length },
        "Auto-applied template",
      );
      results.push({ templateName: template.name, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      log.warn(
        { templateId: template.id, monthId, error: message },
        "Failed to auto-apply template",
      );
      results.push({ templateName: template.name, success: false, error: message });
    }
  }

  return results;
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

  const rows = await prisma.transaction.groupBy({
    by: ["sectionId"],
    where: {
      accountId,
      monthId,
      sectionId: { in: sectionIds },
      table: { countInMonth: true },
    },
    _sum: { amountCents: true },
  });

  return Object.fromEntries(rows.map((r) => [r.sectionId, r._sum.amountCents ?? 0n]));
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

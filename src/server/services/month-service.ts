import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { applyDayToMonth, utcMonthRange } from "@/lib/dates";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  AutoApplyResult,
  CreateMonthInput,
  DeleteMonthInput,
  PreviewMonthAutomationsInput,
} from "@/lib/schemas/months";
import {
  convertPendingInstallmentsForMonth,
  type InstallmentConvertResult,
} from "./installment-service";
import { touchLastUsed } from "./settings-usage-touch";

const log = logger.child({ module: "month-service" });

// ─── Automações do mês (spec 73 §2.4) ─────────────────────────────────────────

/**
 * Motivo pelo qual um item não pode ser aplicado. Código, não prosa: a mensagem
 * é montada no client a partir de `src/lib/messages/` (CLAUDE §5.10).
 */
export type MonthAutomationBlockedReason =
  | "missing_section"
  | "missing_table_type"
  | "section_not_found"
  | "table_type_not_found";

export type MonthAutomationItem = {
  /** templateId (kind=table_template) ou pendingInstallmentId (kind=pending_installment) */
  id: string;
  /** Nome do modelo ou descrição da parcela — dado do usuário, não mensagem de UI */
  label: string;
  sectionName: string | null;
  tableTypeName: string | null;
  /** Quantidade de itens do modelo (null para parcela) */
  itemCount: number | null;
  /** Posição da parcela no grupo (null para modelo) */
  installmentNumber: number | null;
  installmentCount: number | null;
  /** Total a lançar, em centavos, serializado para a borda RSC */
  amountCents: string;
  defaultSelected: boolean;
  blockedReason: MonthAutomationBlockedReason | null;
};

export type MonthAutomationGroup = {
  kind: "table_template" | "pending_installment";
  items: MonthAutomationItem[];
};

/**
 * Dry-run do que a criação do mês vai lançar. NÃO escreve nada — alimenta o
 * passo "Automações" do dialog de novo mês (spec 73 §2.4).
 */
export async function previewMonthAutomations(
  input: PreviewMonthAutomationsInput,
  ctx: ActionContext,
): Promise<MonthAutomationGroup[]> {
  const { from, to } = utcMonthRange(input.year, input.month);

  const [templates, sections, tableTypes, pending] = await Promise.all([
    prisma.tableTemplate.findMany({
      where: { accountId: ctx.accountId, autoApply: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        autoSectionId: true,
        autoTableTypeId: true,
        items: { select: { amountCents: true } },
      },
    }),
    prisma.section.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.tableType.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true },
    }),
    prisma.pendingInstallment.findMany({
      where: {
        accountId: ctx.accountId, // ✅ multi-tenancy
        expectedDate: { gte: from, lte: to },
        settledAt: null,
      },
      orderBy: { expectedDate: "asc" },
      select: {
        id: true,
        installmentNumber: true,
        amountCents: true,
        description: true,
        group: {
          select: {
            description: true,
            installmentCount: true,
            autoCreateOnNewMonth: true,
            sectionId: true,
            tableTypeId: true,
          },
        },
      },
    }),
  ]);

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const tableTypeById = new Map(tableTypes.map((t) => [t.id, t]));

  const templateItems: MonthAutomationItem[] = templates.map((tpl) => {
    const section = tpl.autoSectionId ? sectionById.get(tpl.autoSectionId) : undefined;
    const tableType = tpl.autoTableTypeId ? tableTypeById.get(tpl.autoTableTypeId) : undefined;

    // Mesmas pré-condições que `applyAutoTemplates` exige em runtime — aqui elas
    // viram um item desabilitado com motivo, em vez de falha silenciosa depois.
    const blockedReason: MonthAutomationBlockedReason | null = !tpl.autoSectionId
      ? "missing_section"
      : !tpl.autoTableTypeId
        ? "missing_table_type"
        : !section
          ? "section_not_found"
          : !tableType
            ? "table_type_not_found"
            : null;

    return {
      id: tpl.id,
      label: tpl.name,
      sectionName: section?.name ?? null,
      tableTypeName: tableType?.name ?? null,
      itemCount: tpl.items.length,
      installmentNumber: null,
      installmentCount: null,
      amountCents: tpl.items.reduce((sum, i) => sum + i.amountCents, 0n).toString(),
      defaultSelected: blockedReason === null,
      blockedReason,
    };
  });

  const installmentItems: MonthAutomationItem[] = pending.map((pi) => {
    const section = sectionById.get(pi.group.sectionId);
    const tableType = pi.group.tableTypeId ? tableTypeById.get(pi.group.tableTypeId) : undefined;

    return {
      id: pi.id,
      label: pi.description ?? pi.group.description,
      sectionName: section?.name ?? null,
      tableTypeName: tableType?.name ?? null,
      itemCount: null,
      installmentNumber: pi.installmentNumber,
      installmentCount: pi.group.installmentCount,
      amountCents: pi.amountCents.toString(),
      // Padrão do grupo: import nasce desmarcado (a fatura é a fonte da parcela).
      defaultSelected: pi.group.autoCreateOnNewMonth,
      blockedReason: !section || !section.isActive ? ("section_not_found" as const) : null,
    };
  });

  const groups: MonthAutomationGroup[] = [];
  if (templateItems.length > 0) groups.push({ kind: "table_template", items: templateItems });
  if (installmentItems.length > 0) {
    groups.push({ kind: "pending_installment", items: installmentItems });
  }
  return groups;
}

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

  // `selection` vem do passo "Automações" (spec 73 §2.4). Ausente = comportamento
  // automático: todos os modelos autoApply + pendências de grupos que optaram
  // pela criação automática.
  const autoApplied = await applyAutoTemplates(
    newMonth.id,
    input,
    ctx,
    input.selection?.templateIds,
  );

  const installmentsConverted = await convertPendingInstallmentsForMonth(
    ctx.accountId,
    newMonth.id,
    input.year,
    input.month,
    ctx.userId,
    input.selection ? { pendingInstallmentIds: input.selection.pendingInstallmentIds } : {},
  );

  return { monthId: newMonth.id, autoApplied, installmentsConverted };
}

async function applyAutoTemplates(
  monthId: string,
  input: CreateMonthInput,
  ctx: ActionContext,
  /** Quando presente, aplica só estes modelos (subconjunto dos `autoApply`). */
  templateIds?: string[],
): Promise<AutoApplyResult[]> {
  if (templateIds?.length === 0) return [];

  const templates = await prisma.tableTemplate.findMany({
    where: {
      accountId: ctx.accountId,
      autoApply: true,
      ...(templateIds ? { id: { in: templateIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: [{ displayOrder: "asc" }, { day: "asc" }] } },
  });

  if (templates.length === 0) return [];

  const results: AutoApplyResult[] = [];

  // ─── lastUsedAt (spec 67 §2.4/§7.4, SET-07) ─────────────────────────────────
  // Criar o mês a partir dos modelos é uma das escritas que "consomem" objetos de
  // configuração. Acumulamos aqui e disparamos UM toque só depois do laço — cada
  // modelo tem sua própria `$transaction`, e o toque tem que vir sempre DEPOIS do
  // commit. Só modelos aplicados com sucesso entram: um modelo que falhou não
  // lançou nada, logo não usou nada.
  const used = {
    tableTemplate: [] as Array<string | null>,
    section: [] as Array<string | null>,
    tableType: [] as Array<string | null>,
    category: [] as Array<string | null>,
    subcategory: [] as Array<string | null>,
    institution: [] as Array<string | null>,
    responsibleParty: [] as Array<string | null>,
  };

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

      // Commit feito: registra o consumo deste modelo (ids ficam para o toque
      // único no fim). `touchLastUsed` dedupe e descarta nulos.
      used.tableTemplate.push(template.id);
      used.section.push(template.autoSectionId);
      used.tableType.push(template.autoTableTypeId);
      for (const item of template.items) {
        used.category.push(item.categoryId);
        used.subcategory.push(item.subcategoryId);
        used.institution.push(item.institutionId);
        used.responsibleParty.push(item.responsiblePartyId);
      }

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

  // Fora de qualquer transação e sem `await`: rótulo de recência não pode atrasar
  // a criação do mês nem desfazê-la se o UPDATE falhar (o helper já engole o erro).
  if (used.tableTemplate.length > 0) void touchLastUsed(ctx.accountId, used);

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

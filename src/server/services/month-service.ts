import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { utcMonthRange } from "@/lib/dates";
import { parseDayRule, resolveDayRule } from "@/lib/day-rule";
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
 * Spec 69 D7 — o tipo de tabela do modelo é `tableTypeId`. `autoTableTypeId`
 * ficou DEPRECATED (FU-3) e não é mais escrito, mas ainda existe em linhas
 * antigas: o backfill do P0 fez `table_type_id = COALESCE(table_type_id,
 * auto_table_type_id)`, e este fallback é a rede de segurança barata para
 * qualquer linha que tenha escapado dele. Ler os dois num lugar só é o que
 * impede a divergência entre o preview e a aplicação de voltar.
 */
function resolveTemplateTableTypeId(template: {
  tableTypeId: string | null;
  autoTableTypeId: string | null;
}): string | null {
  return template.tableTypeId ?? template.autoTableTypeId;
}

/**
 * Spec 69 §2.2/§4 — ordem de aplicação dos modelos dentro da seção de destino.
 *
 * `orderInSection` manda; `null` (modelo que nunca definiu ordem) vai para o
 * FIM. Empate desempata pela ordem em que o banco devolveu (`createdAt asc`) —
 * `Array.prototype.sort` é estável desde a ES2019, então o critério de hoje
 * continua valendo para quem não configurou nada.
 *
 * A ordem RELATIVA é o que importa: o `displayOrder` gravado continua vindo do
 * `count()` de tabelas já existentes na seção, então as tabelas nascem
 * contíguas (0, 1, 2…) mesmo que as ordens configuradas tenham buracos.
 */
export function compareTemplateOrder(
  a: { orderInSection: number | null },
  b: { orderInSection: number | null },
): number {
  const orderA = a.orderInSection ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.orderInSection ?? Number.MAX_SAFE_INTEGER;
  return orderA - orderB;
}

/**
 * Spec 69 §4 — "SE o valor de uma transação-modelo for 0,00, A TRANSAÇÃO criada
 * DEVE ficar em branco para o usuário preencher."
 *
 * O QUE "EM BRANCO" SIGNIFICA NESTE MODELO DE DADOS (decisão do pacote P8):
 *
 *  1. `amountCents` é `BigInt` **NOT NULL** — não existe nulo para "sem valor".
 *     O ZERO já É a representação de "vazio" na tabela de transações: tanto
 *     `TransactionRowEditor` quanto `NewTransactionRow` pintam `0n` em
 *     `text.disabled` justamente para ler como placeholder. Então a linha nasce
 *     com `0n` e o usuário digita por cima — não criamos campo novo nem
 *     inventamos sentinela.
 *  2. A linha nasce **PENDENTE**. Uma transação de R$ 0,00 marcada como
 *     confirmada afirma "esta despesa foi de zero reais", que é falso; pendente
 *     afirma "falta preencher", que é a verdade. Como zero não move total
 *     nenhum, o único efeito é a linha aparecer nas listas e KPIs de pendentes —
 *     exatamente onde o usuário procura o que ainda depende dele.
 *  3. Só o VALOR fica em branco. Descrição, categoria, responsável e
 *     instituição vêm do modelo: são eles que dizem ao usuário QUAL linha ele
 *     precisa preencher.
 *
 * Item com valor diferente de zero mantém o `isPending` que o usuário
 * configurou no modelo — nada aqui sobrescreve escolha explícita.
 */
export function blankIfZero(item: { amountCents: bigint; isPending: boolean }): {
  amountCents: bigint;
  isPending: boolean;
} {
  if (item.amountCents === 0n) return { amountCents: 0n, isPending: true };
  return { amountCents: item.amountCents, isPending: item.isPending };
}

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
        orderInSection: true,
        tableTypeId: true,
        autoTableTypeId: true, // legado (D7) — lido só pelo `resolveTemplateTableTypeId`
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

  // Mesma ordem em que `applyAutoTemplates` vai criar as tabelas (Spec 69 §2.2):
  // o preview promete o que a aplicação cumpre.
  const templateItems: MonthAutomationItem[] = [...templates]
    .sort(compareTemplateOrder)
    .map((tpl) => {
      const section = tpl.autoSectionId ? sectionById.get(tpl.autoSectionId) : undefined;
      const tableTypeId = resolveTemplateTableTypeId(tpl);
      const tableType = tableTypeId ? tableTypeById.get(tableTypeId) : undefined;

      // Mesmas pré-condições que `applyAutoTemplates` exige em runtime — aqui elas
      // viram um item desabilitado com motivo, em vez de falha silenciosa depois.
      // Seção INATIVA (Spec 68) entra em `section_not_found`, cuja mensagem já diz
      // "não encontrada ou inativa" e é o mesmo tratamento que a parcela recebe.
      const blockedReason: MonthAutomationBlockedReason | null = !tpl.autoSectionId
        ? "missing_section"
        : !tableTypeId
          ? "missing_table_type"
          : !section || !section.isActive
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

  const found = await prisma.tableTemplate.findMany({
    where: {
      accountId: ctx.accountId,
      autoApply: true,
      ...(templateIds ? { id: { in: templateIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: [{ displayOrder: "asc" }, { day: "asc" }] } },
  });

  if (found.length === 0) return [];

  // Spec 69 §2.2 — `orderInSection` manda na ordem das tabelas dentro da seção;
  // o `createdAt asc` do banco vira o critério de desempate (sort estável).
  const templates = [...found].sort(compareTemplateOrder);

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
      const tableTypeId = resolveTemplateTableTypeId(template);
      if (!template.autoSectionId || !tableTypeId) {
        throw new Error("Seção ou tipo de tabela não configurados no modelo.");
      }

      const [section, tableType] = await Promise.all([
        prisma.section.findFirst({
          where: { id: template.autoSectionId, accountId: ctx.accountId },
          select: { id: true, isActive: true },
        }),
        prisma.tableType.findFirst({
          where: { id: tableTypeId, accountId: ctx.accountId },
        }),
      ]);

      if (!section) throw new Error("Seção configurada não foi encontrada.");
      // Spec 69 §4 — seção INATIVA (Spec 68) não recebe tabela nova. O modelo
      // não é aplicado, entra no `results` como falha (o laço segue para os
      // outros) e vira sinal no hub via `getSettingsAttention`.
      if (!section.isActive) throw new Error("Seção configurada está inativa.");
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
            tableTypeId,
            name: template.name,
            countInMonth: template.countInMonth,
            sourceMethod: "template",
            // Spec 69 D6 — proveniência: QUAL modelo criou esta tabela. Sem
            // backfill; a aba "Onde é usado" declara a data de corte.
            createdFromTemplateId: template.id,
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
              // Spec 69 D2 — o "Dia" do modelo é RELATIVO e só agora vira data:
              // dia fixo maior que o mês cai no último dia (30 em fevereiro →
              // 28/29), `last` é o último dia, `firstBusiness` é o primeiro dia
              // útil. `item.day` continua sendo o fallback de quem foi criado
              // antes da Spec 69 e não tem `dayRule`.
              occurredOn: resolveDayRule(
                parseDayRule(item.dayRule, item.day),
                input.year,
                input.month,
              ),
              ...blankIfZero(item),
              description: item.description,
              notes: item.notes,
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
      used.tableType.push(tableTypeId);
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

import { dayRuleToDay, parseDayRule, resolveDayRule, serializeDayRule } from "@/lib/day-rule";
import type {
  AddTemplateItemInput,
  ApplyTemplateInput,
  CreateTemplateFromTableInput,
  CreateTemplateManualInput,
  DeleteTemplateInput,
  DeleteTemplateItemInput,
  ImportTemplateItemsFromTableInput,
  UpdateTemplateInput,
  UpdateTemplateItemInput,
} from "@/lib/schemas/table-template";
import type { ActionContext } from "@/server/api/define-action";
import { NotFoundError, ConflictError, AppError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "table-template-service" });

async function getTemplateOrThrow(templateId: string, accountId: string) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: templateId, accountId },
    include: { items: { orderBy: [{ displayOrder: "asc" }, { day: "asc" }] } },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");
  return tpl;
}

/**
 * Colunas de um item de modelo que a UI consome.
 *
 * `notes` entrou na Spec 69 P7: sem ler a nota, a aba não podia oferecer o campo —
 * escrever sem ler apagaria a nota de quem já tem uma (a armadilha `undefined` ×
 * `null` da §15, na direção mais cara). Uma fonte só, para o `select` da listagem
 * e o do retorno da importação não divergirem.
 */
const TEMPLATE_ITEM_SELECT = {
  id: true,
  day: true,
  dayRule: true,
  amountCents: true,
  description: true,
  notes: true,
  isPending: true,
  categoryId: true,
  subcategoryId: true,
  institutionId: true,
  responsiblePartyId: true,
  cardInstallment: true,
  investmentType: true,
  displayOrder: true,
} as const;

export async function listTemplates(accountId: string) {
  return prisma.tableTemplate.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { items: true } },
      tableType: { select: { id: true, name: true } },
      items: {
        orderBy: [{ displayOrder: "asc" }, { day: "asc" }],
        select: TEMPLATE_ITEM_SELECT,
      },
    },
  });
}

/** Os campos de uma transação real que viram um item de modelo. */
const TRANSACTION_TO_ITEM_SELECT = {
  occurredOn: true,
  amountCents: true,
  description: true,
  notes: true,
  isPending: true,
  categoryId: true,
  subcategoryId: true,
  institutionId: true,
  responsiblePartyId: true,
  cardInstallment: true,
  investmentType: true,
} as const;

type TransactionSource = {
  occurredOn: Date;
  amountCents: bigint;
  description: string | null;
  notes: string | null;
  isPending: boolean;
  categoryId: string | null;
  subcategoryId: string | null;
  institutionId: string | null;
  responsiblePartyId: string | null;
  cardInstallment: string | null;
  investmentType: string | null;
};

/**
 * Tradução transação real → item de modelo.
 *
 * Extraída porque tem DOIS chamadores com a mesma regra: "Salvar tabela como
 * modelo" (`createFromTable`) e "Importar de um mês" (`importItemsFromTable`).
 * Duplicada, a primeira divergência silenciosa seria um campo novo aparecendo só
 * em um dos dois caminhos.
 */
function templateItemDataFromTransaction(
  tx: TransactionSource,
  accountId: string,
  displayOrder: number,
) {
  // Extrai o dia em UTC (occurredOn é @db.Date sem timezone)
  const day = tx.occurredOn.getUTCDate();
  return {
    accountId,
    day,
    // Spec 69 D2 — transação real vira sempre dia fixo; regras relativas
    // ("último dia", "primeiro dia útil") são escolha explícita do usuário.
    dayRule: String(day),
    amountCents: tx.amountCents,
    description: tx.description,
    notes: tx.notes,
    isPending: tx.isPending,
    categoryId: tx.categoryId,
    subcategoryId: tx.subcategoryId,
    institutionId: tx.institutionId,
    responsiblePartyId: tx.responsiblePartyId,
    cardInstallment: tx.cardInstallment,
    investmentType: tx.investmentType,
    displayOrder,
  };
}

export async function createFromTable(input: CreateTemplateFromTableInput, ctx: ActionContext) {
  const existing = await prisma.tableTemplate.findFirst({
    where: { accountId: ctx.accountId, name: input.name },
  });
  if (existing) throw new ConflictError(`Já existe um modelo com o nome "${input.name}".`);

  const table = await prisma.financeTable.findFirst({
    where: { id: input.tableId, accountId: ctx.accountId },
    include: {
      transactions: { orderBy: { occurredOn: "asc" }, select: TRANSACTION_TO_ITEM_SELECT },
    },
  });
  if (!table) throw new NotFoundError("Tabela financeira");

  return prisma.tableTemplate.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      tableTypeId: table.tableTypeId,
      countInMonth: table.countInMonth,
      createdById: ctx.userId,
      items: {
        create: table.transactions.map((tx, i) =>
          // `accountId` sai do objeto: no `create` aninhado ele já vem do pai.
          templateItemDataFromTransaction(tx, ctx.accountId, i),
        ),
      },
    },
    select: { id: true, name: true, _count: { select: { items: true } } },
  });
}

/**
 * Spec 69 §2.2 / P7 — "Importar de um mês".
 *
 * **Append, nunca substituição.** As transações que o modelo já tem ficam onde
 * estão, com o `displayOrder` que têm; as importadas entram no FIM, continuando a
 * numeração a partir do maior `displayOrder` atual. É o que a descrição do
 * diálogo promete ao usuário, e é o que os testes fixam.
 *
 * Multi-tenancy nas DUAS pontas: o modelo e a tabela de origem são buscados com
 * `accountId` do contexto. Sem o filtro na tabela, um id vazado de outra conta
 * copiaria transações alheias para dentro deste modelo.
 */
export async function importItemsFromTable(
  input: ImportTemplateItemsFromTableInput,
  ctx: ActionContext,
) {
  const template = await prisma.tableTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
    select: { id: true },
  });
  if (!template) throw new NotFoundError("Modelo de tabela");

  const table = await prisma.financeTable.findFirst({
    where: { id: input.tableId, accountId: ctx.accountId },
    select: {
      id: true,
      transactions: { orderBy: { occurredOn: "asc" }, select: TRANSACTION_TO_ITEM_SELECT },
    },
  });
  if (!table) throw new NotFoundError("Tabela financeira");

  if (table.transactions.length > 0) {
    const maxOrder = await prisma.tableTemplateItem.aggregate({
      where: { templateId: input.templateId },
      _max: { displayOrder: true },
    });
    const start = (maxOrder._max.displayOrder ?? -1) + 1;

    await prisma.tableTemplateItem.createMany({
      data: table.transactions.map((tx, i) => ({
        ...templateItemDataFromTransaction(tx, ctx.accountId, start + i),
        templateId: input.templateId,
      })),
    });
  }

  log.info(
    { templateId: input.templateId, tableId: input.tableId, imported: table.transactions.length },
    "template items imported from table",
  );

  // A lista INTEIRA volta (não só as novas): a aba substitui o que tem em vez de
  // concatenar às cegas, então uma divergência de ordem se corrige sozinha.
  return {
    imported: table.transactions.length,
    items: await listTemplateItems(input.templateId, ctx.accountId),
  };
}

/**
 * Itens de um modelo prontos para o cliente — `amountCents` já em string.
 *
 * BigInt não pode sair de uma Server Action como número: o cliente o receberia
 * como `bigint` em runtime e como `any` na prática, e qualquer `JSON.stringify`
 * no caminho (log, cache, devtools) estoura. A fronteira converte uma vez.
 */
export async function listTemplateItems(templateId: string, accountId: string) {
  const items = await prisma.tableTemplateItem.findMany({
    where: { templateId, accountId },
    orderBy: [{ displayOrder: "asc" }, { day: "asc" }],
    select: TEMPLATE_ITEM_SELECT,
  });
  return items.map((item) => ({ ...item, amountCents: item.amountCents.toString() }));
}

export async function createManual(input: CreateTemplateManualInput, ctx: ActionContext) {
  const existing = await prisma.tableTemplate.findFirst({
    where: { accountId: ctx.accountId, name: input.name },
  });
  if (existing) throw new ConflictError(`Já existe um modelo com o nome "${input.name}".`);

  const countInMonth = input.countInMonth ?? true;

  return prisma.tableTemplate.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      description: input.description,
      tableTypeId: input.tableTypeId ?? null,
      countInMonth,
      createdById: ctx.userId,
    },
    select: { id: true, name: true },
  });
}

export async function updateTemplate(input: UpdateTemplateInput, ctx: ActionContext) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");

  const effectiveAutoApply = input.autoApply !== undefined ? input.autoApply : tpl.autoApply;
  const effectiveAutoSectionId =
    input.autoSectionId !== undefined ? input.autoSectionId : tpl.autoSectionId;

  // ── Spec 69 D7 — consolidação do tipo de tabela ──────────────────────────
  // `tableTypeId` é o campo ÚNICO e a partir do pacote P8 o ESPELHO em
  // `autoTableTypeId` NÃO é mais gravado: `month-service.applyAutoTemplates`
  // passou a ler `tableTypeId`, então manter a coluna deprecated em dia deixou
  // de ter consumidor. A coluna continua no schema (FU-3 a droparia) pela mesma
  // cautela usada com `Category.defaultSectionId` na Spec 68 — campo morto é
  // marcado, não removido no mesmo passo em que se muda quem o lê.
  //
  // Chamador legado que só conhece `autoTableTypeId` continua funcionando: o valor
  // que ele manda vira o `tableTypeId`.
  const mentionedTableTypeId =
    input.tableTypeId !== undefined
      ? input.tableTypeId
      : input.autoTableTypeId !== undefined
        ? input.autoTableTypeId
        : undefined;
  const effectiveTableTypeId =
    mentionedTableTypeId !== undefined
      ? mentionedTableTypeId
      : (tpl.tableTypeId ?? tpl.autoTableTypeId);

  if (effectiveAutoApply && (!effectiveAutoSectionId || !effectiveTableTypeId)) {
    throw new AppError(
      "VALIDATION",
      "Seção e tipo de tabela são obrigatórios quando a aplicação automática está ativada.",
    );
  }

  if (effectiveAutoSectionId) {
    const section = await prisma.section.findFirst({
      where: { id: effectiveAutoSectionId, accountId: ctx.accountId },
    });
    if (!section) throw new NotFoundError("Seção configurada no modelo");
  }

  if (effectiveTableTypeId) {
    const tableType = await prisma.tableType.findFirst({
      where: { id: effectiveTableTypeId, accountId: ctx.accountId },
    });
    if (!tableType) throw new NotFoundError("Tipo de tabela configurado no modelo");
  }

  // Construção CAMPO A CAMPO (§15): `undefined` significa "não mencionei" e não
  // pode virar escrita. Nada de spread do input inteiro.
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.countInMonth !== undefined) data.countInMonth = input.countInMonth;
  if (input.autoApply !== undefined) data.autoApply = input.autoApply;
  if (input.autoSectionId !== undefined) data.autoSectionId = input.autoSectionId;
  if (input.orderInSection !== undefined) data.orderInSection = input.orderInSection;
  if (mentionedTableTypeId !== undefined) {
    data.tableTypeId = mentionedTableTypeId;
  } else if (!tpl.tableTypeId && tpl.autoTableTypeId) {
    // Linha antiga que só tem o campo deprecated preenchido (escapou do backfill
    // do P0): consolida na primeira escrita, na mesma direção do
    // `table_type_id = COALESCE(table_type_id, auto_table_type_id)`.
    data.tableTypeId = tpl.autoTableTypeId;
  }

  return prisma.tableTemplate.update({
    where: { id: input.templateId },
    data,
    select: { id: true, name: true },
  });
}

export async function deleteTemplate(input: DeleteTemplateInput, ctx: ActionContext) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");

  await prisma.tableTemplate.delete({ where: { id: input.templateId } });
  log.info({ templateId: input.templateId }, "Table template deleted");
}

export async function addItem(input: AddTemplateItemInput, ctx: ActionContext) {
  const tpl = await prisma.tableTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Modelo de tabela");

  const maxOrder = await prisma.tableTemplateItem.aggregate({
    where: { templateId: input.templateId },
    _max: { displayOrder: true },
  });

  // Spec 69 D2 — `dayRule` é a forma rica; `day` continua NOT NULL e é mantido em
  // espelho (`last` → 31, `firstBusiness` → 1) porque ainda ordena os itens.
  const rule = parseDayRule(input.dayRule ?? null, input.day ?? 1);

  return prisma.tableTemplateItem.create({
    data: {
      templateId: input.templateId,
      accountId: ctx.accountId,
      day: dayRuleToDay(rule),
      dayRule: serializeDayRule(rule),
      amountCents: BigInt(input.amountCents),
      description: input.description ?? null,
      notes: input.notes ?? null,
      isPending: input.isPending ?? false,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      institutionId: input.institutionId ?? null,
      responsiblePartyId: input.responsiblePartyId ?? null,
      cardInstallment: input.cardInstallment ?? null,
      investmentType: input.investmentType ?? null,
      displayOrder: input.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
    },
  });
}

export async function updateItem(input: UpdateTemplateItemInput, ctx: ActionContext) {
  const item = await prisma.tableTemplateItem.findFirst({
    where: { id: input.itemId, accountId: ctx.accountId },
  });
  if (!item) throw new NotFoundError("Item do modelo");

  // Construção CAMPO A CAMPO (§15): spread do input vaza campo que o chamador
  // não pediu para mudar e, aqui, dessincronizaria `day` de `dayRule`.
  const data: Record<string, unknown> = {};

  if (input.day !== undefined || input.dayRule !== undefined) {
    // `dayRule` manda quando os dois vêm; quando só `day` vem, é dia fixo novo.
    const raw = input.dayRule ?? (input.day !== undefined ? String(input.day) : item.dayRule);
    const rule = parseDayRule(raw, input.day ?? item.day);
    data.day = dayRuleToDay(rule);
    data.dayRule = serializeDayRule(rule);
  }
  if (input.amountCents !== undefined) data.amountCents = BigInt(input.amountCents);
  if (input.description !== undefined) data.description = input.description;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.isPending !== undefined) data.isPending = input.isPending;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.subcategoryId !== undefined) data.subcategoryId = input.subcategoryId;
  if (input.institutionId !== undefined) data.institutionId = input.institutionId;
  if (input.responsiblePartyId !== undefined) data.responsiblePartyId = input.responsiblePartyId;
  if (input.cardInstallment !== undefined) data.cardInstallment = input.cardInstallment;
  if (input.investmentType !== undefined) data.investmentType = input.investmentType;
  // Spec 69 P7 — reordenar pelo arraste. Mesma guarda dos demais: só grava se o
  // chamador MENCIONOU o campo. Um `?? item.displayOrder` aqui reescreveria a
  // ordem a cada edição de descrição, desfazendo o arraste anterior.
  if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;

  return prisma.tableTemplateItem.update({ where: { id: input.itemId }, data });
}

export async function deleteItem(input: DeleteTemplateItemInput, ctx: ActionContext) {
  const item = await prisma.tableTemplateItem.findFirst({
    where: { id: input.itemId, accountId: ctx.accountId },
  });
  if (!item) throw new NotFoundError("Item do modelo");

  await prisma.tableTemplateItem.delete({ where: { id: input.itemId } });
}

export async function applyTemplate(
  input: ApplyTemplateInput,
  ctx: ActionContext,
): Promise<{ tableId: string }> {
  const template = await getTemplateOrThrow(input.templateId, ctx.accountId);

  const [month, section] = await Promise.all([
    prisma.month.findFirst({ where: { id: input.monthId, accountId: ctx.accountId } }),
    prisma.section.findFirst({ where: { id: input.sectionId, accountId: ctx.accountId } }),
  ]);
  if (!month) throw new NotFoundError("Mês");
  if (!section) throw new NotFoundError("Seção");

  const result = await prisma.$transaction(async (tx) => {
    const tableCount = await tx.financeTable.count({
      where: { monthId: input.monthId, sectionId: input.sectionId },
    });

    const table = await tx.financeTable.create({
      data: {
        accountId: ctx.accountId,
        monthId: input.monthId,
        sectionId: input.sectionId,
        tableTypeId: input.tableTypeId ?? template.tableTypeId,
        name: input.name,
        countInMonth: input.countInMonth ?? template.countInMonth,
        sourceMethod: "template",
        // Spec 69 D6 — proveniência para a aba "Onde é usado" dos Modelos.
        createdFromTemplateId: template.id,
        displayOrder: tableCount,
        createdById: ctx.userId,
      },
    });

    if (template.items.length > 0) {
      await tx.transaction.createMany({
        data: template.items.map((item) => ({
          accountId: ctx.accountId,
          monthId: input.monthId,
          tableId: table.id,
          sectionId: input.sectionId,
          // Spec 69 D2 — o dia é RELATIVO: "último dia" e "primeiro dia útil"
          // resolvem para a data real do mês em que a tabela nasce.
          occurredOn: resolveDayRule(parseDayRule(item.dayRule, item.day), month.year, month.month),
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
          source: "template",
          createdById: ctx.userId,
          metadata: {},
        })),
      });
    }

    return table;
  });

  log.info(
    { templateId: input.templateId, tableId: result.id, items: template.items.length },
    "Template applied",
  );
  return { tableId: result.id };
}

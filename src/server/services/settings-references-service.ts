// Spec 68 §2.5 / §2.6 (EST-08) — referências de CONFIGURAÇÃO a um objeto de estrutura.
//
// É o "raio de impacto barato": tabelas pequenas e limitadas (apelidos, templates de
// importação, itens de modelo, filtros de widget) que apontam para uma categoria,
// instituição ou responsável. Alimenta os dois diálogos que precisam avisar antes de
// destruir: **M2** (excluir com realocação) e **M5** (mesclar).
//
// NÃO conta `Transaction` — isso é `settings-usage-service`, sob demanda e com cache
// de 24 h (Spec 67 SET-07). Aqui tudo responde de imediato.
//
// Um serviço só, e não um por diálogo: se M2 e M5 contassem por conta própria, os dois
// números divergiriam no dia em que alguém acrescentasse uma referência nova — e o
// usuário veria "2 apelidos" ao mesclar e "3 apelidos" ao excluir o mesmo objeto.

import type { Prisma } from "@prisma/client";

import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "settings-references-service" });

/** Objetos de estrutura que podem ser mesclados ou excluídos com realocação. */
export type ReferencedEntity = "category" | "subcategory" | "institution" | "responsibleParty";

/** Cada tipo de referência vira uma linha no M2 e um chip no M5. */
export type ReferenceKind =
  | "aliases"
  | "templateDefaults"
  | "templateItems"
  | "widgetFilters"
  | "accountDefault";

export type ReferenceGroup = {
  kind: ReferenceKind;
  count: number;
};

export type ReferenceSummary = {
  groups: ReferenceGroup[];
  /** Soma de todas as referências de configuração — nomeia o botão do M2. */
  total: number;
};

/**
 * Procura `id` em qualquer profundidade de um valor `Json`.
 *
 * Os filtros de widget vivem em `DashboardLayout.widgets[].config`, cujo formato muda
 * por widget (cada um tem seu `configSchema`). Enumerar todos aqui garantiria que o
 * próximo widget criado passasse despercebido — e um filtro apontando para categoria
 * excluída quebra o dashboard em silêncio. Varrer o valor é resistente a isso.
 */
function jsonReferencesId(value: unknown, id: string): boolean {
  if (typeof value === "string") return value === id;
  if (Array.isArray(value)) return value.some((v) => jsonReferencesId(v, id));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) => jsonReferencesId(v, id));
  }
  return false;
}

/** O `where` de `TransactionAlias` que caracteriza "este apelido usa o objeto". */
function aliasWhere(entity: ReferencedEntity, id: string): Prisma.TransactionAliasWhereInput {
  switch (entity) {
    case "category":
      return { categoryId: id };
    case "subcategory":
      return { subcategoryId: id };
    case "institution":
      // A instituição aparece em DOIS papéis no apelido: como valor aplicado e como
      // condição de correspondência. Contar só o primeiro deixaria o usuário excluir
      // uma instituição que ainda filtra apelidos — que então nunca mais casariam.
      return { OR: [{ institutionId: id }, { conditionInstitutionId: id }] };
    case "responsibleParty":
      return { responsiblePartyId: id };
  }
}

/** O `where` de `TableTemplateItem` (transações de modelo). */
function templateItemWhere(entity: ReferencedEntity, id: string): Prisma.TableTemplateItemWhereInput {
  switch (entity) {
    case "category":
      return { categoryId: id };
    case "subcategory":
      return { subcategoryId: id };
    case "institution":
      return { institutionId: id };
    case "responsibleParty":
      return { responsiblePartyId: id };
  }
}

/**
 * Templates de importação cujo **de-para** aponta para o objeto.
 *
 * ⚠️ Diferente das outras contagens: `CsvTemplate.mapping` é uma coluna `Json` e não
 * existe índice para filtrar `defaultCategoryId`. Carregamos os templates da conta
 * (poucos, limitados por conta) e filtramos em memória. Barato, mas é varredura de
 * Json — não confunda com um `count` indexado ao ler o log.
 */
async function countTemplateDefaults(
  accountId: string,
  entity: ReferencedEntity,
  id: string,
): Promise<number> {
  // Só categoria e instituição têm default no mapeamento de importação.
  if (entity !== "category" && entity !== "institution") return 0;

  const templates = await prisma.csvTemplate.findMany({
    where: { accountId },
    select: { mapping: true },
  });

  const field = entity === "category" ? "defaultCategoryId" : "defaultInstitutionId";

  return templates.filter((t) => {
    const mapping = t.mapping as Record<string, unknown> | null;
    return mapping?.[field] === id;
  }).length;
}

/** Widgets de dashboard cuja configuração referencia o objeto. */
async function countWidgetFilters(accountId: string, id: string): Promise<number> {
  const layouts = await prisma.dashboardLayout.findMany({
    where: { accountId },
    select: { widgets: true },
  });

  let count = 0;
  for (const layout of layouts) {
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    for (const widget of widgets) {
      // O id pode estar em `config` ou em qualquer campo que um widget futuro
      // inventar — por isso a varredura é no widget inteiro, não só em `config`.
      if (jsonReferencesId(widget, id)) count += 1;
    }
  }
  return count;
}

/**
 * Quantas configurações da conta apontam para este objeto.
 *
 * Multi-tenancy: `accountId` entra em TODO `where`. Um id de outra conta simplesmente
 * não encontra nada — a função não vaza a existência do objeto alheio.
 *
 * Grupos com zero **são** devolvidos: o M5 mostra "0 widgets" de propósito, porque
 * "verificamos e não há" é uma informação diferente de "não verificamos".
 */
export async function getConfigReferences(
  accountId: string,
  entity: ReferencedEntity,
  entityId: string,
): Promise<ReferenceSummary> {
  const [aliases, templateItems, templateDefaults, widgetFilters, accountDefault] =
    await Promise.all([
      prisma.transactionAlias.count({ where: { accountId, ...aliasWhere(entity, entityId) } }),
      prisma.tableTemplateItem.count({
        where: { accountId, ...templateItemWhere(entity, entityId) },
      }),
      countTemplateDefaults(accountId, entity, entityId),
      countWidgetFilters(accountId, entityId),
      // Só o responsável tem um default no nível da conta.
      entity === "responsibleParty"
        ? prisma.accountSettings.count({
            where: { accountId, defaultResponsiblePartyId: entityId },
          })
        : Promise.resolve(0),
    ]);

  const groups: ReferenceGroup[] = [
    { kind: "aliases", count: aliases },
    { kind: "templateDefaults", count: templateDefaults },
    { kind: "templateItems", count: templateItems },
    { kind: "widgetFilters", count: widgetFilters },
    { kind: "accountDefault", count: accountDefault },
  ];

  const total = groups.reduce((sum, g) => sum + g.count, 0);

  log.debug({ accountId, entity, entityId, total }, "Referências de configuração contadas");

  return { groups, total };
}

// Spec 68 §2.5 (EST-07) — mesclar dois objetos de estrutura que significam a mesma coisa.
//
// "Restaurante" e "Restaurantes" coexistem, e sem isto a única saída é excluir uma e
// reclassificar tudo à mão. A absorvida deixa de existir; a mantida recebe TODAS as
// referências: transações, apelidos, itens de modelo, de-para de importação, filtros de
// widget e o default da conta.
//
// **IRREVERSÍVEL (decisão D5).** Não há undo de 7 dias. Desfazer exigiria saber quais
// linhas se moveram, e `Transaction.updatedAt` é `@updatedAt` — tocado por qualquer
// edição posterior, logo inútil como âncora. Em troca: o diálogo diz "irreversível" com
// essas palavras, e o evento vai para a Trilha de auditoria com as contagens movidas.
// Se o undo voltar à mesa, o caminho é uma tabela `MergeOperation` com os ids movidos.

import type { Prisma, PrismaClient } from "@prisma/client";

import type { ActionContext } from "@/server/api/define-action";
import { ConflictError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type { ReferencedEntity } from "@/server/services/settings-references-service";

const log = logger.child({ module: "settings-merge-service" });

/** Cliente dentro da `$transaction` — mesmo shape do `prisma`, sem os métodos de topo. */
type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type MergeEntityInput = {
  entity: ReferencedEntity;
  /** Será excluída. */
  absorbedId: string;
  /** Recebe tudo. */
  keptId: string;
};

export type MergeResult = {
  transactions: number;
  aliases: number;
  templateItems: number;
  templateDefaults: number;
  widgetFilters: number;
  /** Subcategorias movidas junto (só quando a entidade é categoria). */
  subcategories: number;
};

/** Nome legível da entidade, para o erro e para o log de auditoria. */
const ENTITY_LABEL: Record<ReferencedEntity, string> = {
  category: "Categoria",
  subcategory: "Subcategoria",
  institution: "Instituição",
  responsibleParty: "Responsável",
};

/**
 * Confirma que os dois objetos existem NESTA conta e que a mesclagem é legítima.
 * Devolve os nomes para a auditoria.
 *
 * As guardas de `kind`/pai não são redundância da UI: a action é alcançável
 * diretamente, e quem chama com ids escolhidos a dedo não passa pelos filtros que a
 * tela aplica às opções do select.
 */
async function loadPair(
  entity: ReferencedEntity,
  accountId: string,
  absorbedId: string,
  keptId: string,
): Promise<{ absorbedName: string; keptName: string }> {
  const where = { accountId, id: { in: [absorbedId, keptId] } };

  if (entity === "responsibleParty") {
    const rows = await prisma.responsibleParty.findMany({
      where,
      select: { id: true, name: true, kind: true },
    });
    const absorbed = rows.find((r) => r.id === absorbedId);
    const kept = rows.find((r) => r.id === keptId);
    if (!absorbed || !kept) throw new NotFoundError(ENTITY_LABEL[entity]);

    // `deleteResponsibleParty` já protege o pessoal; mesclar é outro caminho para o
    // mesmo fim (o absorvido é excluído), e sem esta guarda daria para apagar o
    // responsável automático de um membro por fora.
    if (absorbed.kind === "personal" || kept.kind === "personal") {
      throw new ConflictError("Responsáveis pessoais não podem ser mesclados.");
    }

    return { absorbedName: absorbed.name, keptName: kept.name };
  }

  if (entity === "subcategory") {
    const rows = await prisma.subcategory.findMany({
      where,
      select: { id: true, name: true, categoryId: true },
    });
    const absorbed = rows.find((r) => r.id === absorbedId);
    const kept = rows.find((r) => r.id === keptId);
    if (!absorbed || !kept) throw new NotFoundError(ENTITY_LABEL[entity]);

    // Mesclar subcategorias de pais diferentes deixaria transações com `categoryId` de
    // uma categoria e `subcategoryId` que passou a viver em outra — um par incoerente
    // que nenhuma tela sabe exibir.
    if (absorbed.categoryId !== kept.categoryId) {
      throw new ConflictError("As duas subcategorias precisam ser da mesma categoria.");
    }

    return { absorbedName: absorbed.name, keptName: kept.name };
  }

  const select = { id: true, name: true };
  const rows =
    entity === "category"
      ? await prisma.category.findMany({ where, select })
      : await prisma.institution.findMany({ where, select });

  const absorbed = rows.find((r) => r.id === absorbedId);
  const kept = rows.find((r) => r.id === keptId);

  // Um id de outra conta cai aqui como "não existe" — a função não confirma nem nega
  // a existência do objeto alheio.
  if (!absorbed || !kept) throw new NotFoundError(ENTITY_LABEL[entity]);

  return { absorbedName: absorbed.name, keptName: kept.name };
}

/** Substitui `from` por `to` em qualquer profundidade de um valor `Json`. */
function replaceIdInJson(value: unknown, from: string, to: string): unknown {
  if (typeof value === "string") return value === from ? to : value;
  if (Array.isArray(value)) return value.map((v) => replaceIdInJson(v, from, to));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        replaceIdInJson(v, from, to),
      ]),
    );
  }
  return value;
}

/** O campo de FK da entidade em `Transaction`, `TransactionAlias` e `TableTemplateItem`. */
const FK_FIELD: Record<ReferencedEntity, string> = {
  category: "categoryId",
  subcategory: "subcategoryId",
  institution: "institutionId",
  responsibleParty: "responsiblePartyId",
};

/**
 * Move as subcategorias da categoria absorvida para a mantida.
 *
 * `Subcategory` tem `@@unique([categoryId, name])`: se as duas categorias têm uma
 * "Mercado", mover às cegas violaria a constraint e derrubaria a transação inteira.
 * Em colisão, a subcategoria da absorvida é **fundida** na homônima da mantida
 * (transações e apelidos apontam para a sobrevivente) e depois excluída — que é o
 * resultado que o usuário espera ao dizer "estas duas são a mesma coisa".
 */
async function moveSubcategories(
  tx: Tx,
  accountId: string,
  absorbedId: string,
  keptId: string,
): Promise<number> {
  const [fromSubs, toSubs] = await Promise.all([
    tx.subcategory.findMany({ where: { accountId, categoryId: absorbedId }, select: { id: true, name: true } }),
    tx.subcategory.findMany({ where: { accountId, categoryId: keptId }, select: { id: true, name: true } }),
  ]);

  const survivorByName = new Map(toSubs.map((s) => [s.name, s.id]));
  let moved = 0;

  for (const sub of fromSubs) {
    const collision = survivorByName.get(sub.name);

    if (!collision) {
      await tx.subcategory.update({ where: { id: sub.id }, data: { categoryId: keptId } });
      moved += 1;
      continue;
    }

    await tx.transaction.updateMany({
      where: { accountId, subcategoryId: sub.id },
      data: { subcategoryId: collision },
    });
    await tx.transactionAlias.updateMany({
      where: { accountId, subcategoryId: sub.id },
      data: { subcategoryId: collision },
    });
    await tx.tableTemplateItem.updateMany({
      where: { accountId, subcategoryId: sub.id },
      data: { subcategoryId: collision },
    });
    await tx.subcategory.delete({ where: { id: sub.id } });
    moved += 1;
  }

  return moved;
}

/**
 * Mescla `absorbedId` em `keptId`.
 *
 * Tudo dentro de uma `$transaction`: uma falha no meio deixaria transações apontando
 * para uma categoria já excluída — pior que não ter mesclado.
 *
 * Multi-tenancy: `accountId` entra em TODO `where`, inclusive nos `updateMany`.
 */
export async function mergeEntity(input: MergeEntityInput, ctx: ActionContext): Promise<MergeResult> {
  const { entity, absorbedId, keptId } = input;

  if (absorbedId === keptId) {
    throw new ConflictError("Escolha dois objetos diferentes para mesclar.");
  }

  const { absorbedName, keptName } = await loadPair(entity, ctx.accountId, absorbedId, keptId);
  const fk = FK_FIELD[entity];
  const accountId = ctx.accountId;

  const result = await prisma.$transaction(async (tx) => {
    const txClient = tx as unknown as Tx;

    const transactions = await txClient.transaction.updateMany({
      where: { accountId, [fk]: absorbedId } as Prisma.TransactionWhereInput,
      data: { [fk]: keptId } as Prisma.TransactionUpdateManyMutationInput,
    });

    // A instituição aparece em dois papéis no apelido (valor aplicado e condição de
    // correspondência); os dois precisam migrar, senão o apelido deixa de casar.
    const aliases = await txClient.transactionAlias.updateMany({
      where: { accountId, [fk]: absorbedId } as Prisma.TransactionAliasWhereInput,
      data: { [fk]: keptId } as Prisma.TransactionAliasUpdateManyMutationInput,
    });
    let aliasCount = aliases.count;
    if (entity === "institution") {
      const conditions = await txClient.transactionAlias.updateMany({
        where: { accountId, conditionInstitutionId: absorbedId },
        data: { conditionInstitutionId: keptId },
      });
      aliasCount += conditions.count;
    }

    const templateItems = await txClient.tableTemplateItem.updateMany({
      where: { accountId, [fk]: absorbedId } as Prisma.TableTemplateItemWhereInput,
      data: { [fk]: keptId } as Prisma.TableTemplateItemUpdateManyMutationInput,
    });

    const subcategories =
      entity === "category" ? await moveSubcategories(txClient, accountId, absorbedId, keptId) : 0;

    // De-para de importação e filtros de widget vivem em colunas `Json`: não há
    // `updateMany` que os alcance, então é ler, reescrever e gravar.
    let templateDefaults = 0;
    if (entity === "category" || entity === "institution") {
      const field = entity === "category" ? "defaultCategoryId" : "defaultInstitutionId";
      const templates = await txClient.csvTemplate.findMany({
        where: { accountId },
        select: { id: true, mapping: true },
      });
      for (const t of templates) {
        const mapping = t.mapping as Record<string, unknown> | null;
        if (mapping?.[field] !== absorbedId) continue;
        await txClient.csvTemplate.update({
          where: { id: t.id },
          data: { mapping: { ...mapping, [field]: keptId } as Prisma.InputJsonValue },
        });
        templateDefaults += 1;
      }
    }

    let widgetFilters = 0;
    const layouts = await txClient.dashboardLayout.findMany({
      where: { accountId },
      select: { id: true, widgets: true },
    });
    for (const layout of layouts) {
      const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
      const rewritten = replaceIdInJson(widgets, absorbedId, keptId);
      if (JSON.stringify(rewritten) === JSON.stringify(widgets)) continue;
      await txClient.dashboardLayout.update({
        where: { id: layout.id },
        data: { widgets: rewritten as Prisma.InputJsonValue },
      });
      widgetFilters += 1;
    }

    if (entity === "responsibleParty") {
      await txClient.accountSettings.updateMany({
        where: { accountId, defaultResponsiblePartyId: absorbedId },
        data: { defaultResponsiblePartyId: keptId },
      });
    }

    // A absorvida sai por último: enquanto houver FK apontando para ela, o delete
    // falharia (ou zeraria a FK por `SetNull`, perdendo o vínculo que acabamos de mover).
    if (entity === "category") await txClient.category.delete({ where: { id: absorbedId } });
    else if (entity === "subcategory") await txClient.subcategory.delete({ where: { id: absorbedId } });
    else if (entity === "institution") await txClient.institution.delete({ where: { id: absorbedId } });
    else await txClient.responsibleParty.delete({ where: { id: absorbedId } });

    const counts: MergeResult = {
      transactions: transactions.count,
      aliases: aliasCount,
      templateItems: templateItems.count,
      templateDefaults,
      widgetFilters,
      subcategories,
    };

    // Sem undo (D5), a Trilha de auditoria é o ÚNICO registro do que aconteceu —
    // por isso guarda nomes e contagens, não só os ids.
    await txClient.auditLog.create({
      data: {
        accountId,
        actorUserId: ctx.userId,
        action: "settings.merge",
        targetType: entity,
        targetId: keptId,
        metadata: { absorbedId, absorbedName, keptId, keptName, counts } as Prisma.InputJsonValue,
      },
    });

    return counts;
  });

  log.info({ accountId, entity, absorbedId, keptId, ...result }, "Objetos mesclados");

  return result;
}

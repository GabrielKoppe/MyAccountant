// Spec 68 §2.2 (EST-04) — preview e aplicação da importação de categorias (modal M4).
//
// Duas operações sobre a MESMA classificação:
//   `previewCategoryImport` — só lê e devolve o plano;
//   `applyCategoryImport`   — grava exatamente o que o plano diz.
//
// O servidor **reclassifica** em vez de confiar no plano que o cliente exibiu. Entre
// abrir o modal e clicar em "Aplicar", outra pessoa da conta pode ter criado uma
// categoria — aplicar o plano antigo criaria uma duplicata que a unique rejeitaria, ou
// atualizaria algo que já não é o que estava na tela. Reclassificar é o que faz o
// número no botão ser verdade no instante da gravação.

import {
  classifyCategoryImport,
  type AccountSnapshot,
  type CategoryImportRow,
  type ImportPlan,
} from "@/lib/category-import";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "category-import-service" });

export type CategoryImportInput = {
  rows: CategoryImportRow[];
  /** Desativa as categorias da conta que não aparecem no arquivo. */
  deactivateMissing?: boolean;
};

export type ApplyImportResult = {
  created: number;
  updated: number;
  deactivated: number;
};

/**
 * Retrato da conta usado pela classificação. Sempre filtrado por `accountId`.
 *
 * Não busca `Section` mais: a coluna `seção` do arquivo não tem destino (tratada como
 * `cor` — aceita, reportada como ignorada, nunca validada contra a conta), então a
 * classificação não precisa mais das seções para decidir nada.
 */
async function loadSnapshot(accountId: string): Promise<AccountSnapshot> {
  const categories = await prisma.category.findMany({
    where: { accountId },
    select: {
      id: true,
      name: true,
      subcategories: { select: { id: true, name: true } },
    },
  });

  return { categories };
}

/** O plano, sem gravar nada. É o que o M4 mostra. */
export async function previewCategoryImport(
  input: CategoryImportInput,
  ctx: ActionContext,
): Promise<ImportPlan> {
  const snapshot = await loadSnapshot(ctx.accountId);
  return classifyCategoryImport(input.rows, snapshot);
}

/**
 * Aplica o plano.
 *
 * Tudo numa `$transaction`: uma importação pela metade deixaria subcategorias órfãs
 * de pais que não chegaram a ser criados.
 *
 * As linhas `error` e `skip` são simplesmente puladas — uma linha ruim não impede as
 * outras (critério da §4).
 */
export async function applyCategoryImport(
  input: CategoryImportInput,
  ctx: ActionContext,
): Promise<ApplyImportResult> {
  const accountId = ctx.accountId;
  const snapshot = await loadSnapshot(accountId);
  const plan = classifyCategoryImport(input.rows, snapshot);

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    // Sem `seção`/`cor` para gravar, uma categoria de topo já existente nunca sai do
    // classificador como `update` (ver `classifyCategoryImport`) — o contador fica
    // aqui só para o formato de `ApplyImportResult` não mudar para quem consome.
    const updated = 0;

    // Os pais precisam existir antes dos filhos: as categorias de topo vão primeiro,
    // e o mapa nome → id que sai daqui é o que resolve o pai criado NESTE arquivo.
    const idByName = new Map(snapshot.categories.map((c) => [c.name.toLowerCase(), c.id]));

    for (const row of plan.rows) {
      if (row.action !== "create" || row.parent) continue;

      const category = await tx.category.create({
        data: {
          accountId,
          name: row.name,
          createdById: ctx.userId,
        },
        select: { id: true },
      });
      idByName.set(row.name.toLowerCase(), category.id);
      created += 1;
    }

    for (const row of plan.rows) {
      if (row.action !== "create" || !row.parent) continue;

      const parentId = row.parentId ?? idByName.get(row.parent.toLowerCase());
      // O pai só pode faltar aqui se ele próprio era uma linha de erro; a
      // subcategoria dele é pulada em vez de derrubar a importação inteira.
      if (!parentId) continue;

      await tx.subcategory.create({
        data: { accountId, categoryId: parentId, name: row.name },
      });
      created += 1;
    }

    let deactivated = 0;
    if (input.deactivateMissing) {
      const inFile = new Set(plan.rows.filter((r) => !r.parent).map((r) => r.name.toLowerCase()));
      const missing = snapshot.categories.filter((c) => !inFile.has(c.name.toLowerCase()));

      if (missing.length > 0) {
        const res = await tx.category.updateMany({
          where: { accountId, id: { in: missing.map((c) => c.id) } },
          // Desativa, nunca exclui: a categoria pode ter anos de transação atrás dela,
          // e "não estava no arquivo" não é motivo para destruir histórico.
          data: { status: "inactive" },
        });
        deactivated = res.count;
      }
    }

    return { created, updated, deactivated };
  });

  log.info({ accountId, ...result }, "Importação de categorias aplicada");

  return result;
}

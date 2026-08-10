// Spec 67 §2.4 / §7.4 (SET-07) — gravação de `lastUsedAt` nos pontos de consumo.
//
// O MODELO: a coluna "Uso" saiu das listas porque contar transações por objeto
// custa uma varredura que cresce com a conta. No lugar entrou `lastUsedAt`, que
// é gravado NA ESCRITA que consome o objeto e lido de graça. Este módulo é o
// único lugar que faz essa gravação.
//
// Fire-and-forget, sempre FORA da transação de negócio: o toque em `lastUsedAt`
// é telemetria de uso, não regra. Se falhar, o pior que acontece é o rótulo
// mostrar um mês antigo — nunca pode derrubar a criação de uma transação nem
// atrasar a resposta. Mesmo padrão já usado em `McpGrant.lastUsedAt`
// (src/app/api/[transport]/route.ts).

import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

/** Entidades de configuração que têm `lastUsedAt` (Spec 67 §7.4 — as 10 de D1). */
export type TouchableEntity =
  | "section"
  | "category"
  | "subcategory"
  | "institution"
  | "responsibleParty"
  | "tableType"
  | "tableTemplate"
  | "csvTemplate"
  | "transactionAlias"
  | "checklistItem";

/** Ids por entidade. `null`/`undefined` são descartados pelo próprio helper. */
export type UsageTouch = Partial<Record<TouchableEntity, Array<string | null | undefined>>>;

/**
 * Delegates do Prisma indexados pela entidade. Mantido explícito (e não por
 * acesso dinâmico solto) para o TypeScript garantir que toda entidade listada
 * em `TouchableEntity` realmente tem `updateMany` com `lastUsedAt`.
 */
const DELEGATES = {
  section: () => prisma.section,
  category: () => prisma.category,
  subcategory: () => prisma.subcategory,
  institution: () => prisma.institution,
  responsibleParty: () => prisma.responsibleParty,
  tableType: () => prisma.tableType,
  tableTemplate: () => prisma.tableTemplate,
  csvTemplate: () => prisma.csvTemplate,
  transactionAlias: () => prisma.transactionAlias,
  checklistItem: () => prisma.checklistItem,
} as const satisfies Record<TouchableEntity, () => { updateMany: (args: never) => unknown }>;

/**
 * Marca os objetos consumidos como "usados agora".
 *
 * NÃO É `await`-ado por quem chama (dispare com `void`). Todo `where` carrega
 * `accountId` — é escrita, e escrita sem filtro de tenant é vazamento.
 *
 * @param accountId conta corrente (multi-tenancy)
 * @param touch ids por entidade; duplicatas e nulos são descartados
 * @param at instante a gravar; default `new Date()` (injetável para teste)
 */
export async function touchLastUsed(
  accountId: string,
  touch: UsageTouch,
  at: Date = new Date(),
): Promise<void> {
  const entries = Object.entries(touch) as Array<[TouchableEntity, Array<string | null | undefined>]>;

  const updates = entries
    .map(([entity, rawIds]) => {
      const ids = [...new Set(rawIds.filter((id): id is string => Boolean(id)))];
      return { entity, ids };
    })
    .filter(({ ids }) => ids.length > 0)
    .map(({ entity, ids }) =>
      (DELEGATES[entity]() as { updateMany: (args: unknown) => Promise<unknown> }).updateMany({
        where: { id: { in: ids }, accountId },
        data: { lastUsedAt: at },
      }),
    );

  if (updates.length === 0) return;

  try {
    await Promise.all(updates);
  } catch (error) {
    // Engolir de propósito: `lastUsedAt` é rótulo de recência, não dado de
    // negócio. Quem chamou já respondeu ao usuário.
    logger.warn({ err: error, accountId }, "Falha ao gravar lastUsedAt (ignorado)");
  }
}

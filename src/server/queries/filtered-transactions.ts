import type { Prisma } from "@prisma/client";
import { cache } from "react";

import type { TxRow } from "@/components/dashboards/panels/TopTransactionTable";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import {
  filteredTransactionsConfigSchema,
  type FilteredTransactionsConfig,
} from "@/lib/schemas/widget-config";
import { prisma } from "@/server/prisma";

import { responsiblePartyIdsForFilter } from "./responsible-party-filter";

// Transações de um mês filtradas pelo config do widget filtered-transactions,
// ordenadas da mais recente para a mais antiga e limitadas por `limit`.
export const getFilteredTransactions = cache(
  async (
    accountId: string,
    monthId: string,
    config: FilteredTransactionsConfig,
  ): Promise<TxRow[]> => {
    // config.responsible guarda partyIds (A1 — todas as kinds de persona), com fallback
    // de legado para configs antigas que guardavam userId. Ver responsiblePartyIdsForFilter.
    const responsiblePartyIds = await responsiblePartyIdsForFilter(accountId, config.responsible);

    const where: Prisma.TransactionWhereInput = {
      accountId,
      monthId,
      table: { countInMonth: true },
      ...(config.categories.length ? { categoryId: { in: config.categories } } : {}),
      ...(config.institutions.length ? { institutionId: { in: config.institutions } } : {}),
      ...(responsiblePartyIds.length ? { responsiblePartyId: { in: responsiblePartyIds } } : {}),
      ...(config.pending ? { isPending: true } : {}),
      ...(config.favorite ? { isFavorite: true } : {}),
      ...(config.expenseTypes.length ? { expenseType: { in: config.expenseTypes } } : {}),
      ...(config.sources.length ? { source: { in: config.sources } } : {}),
      ...(config.paymentMethods.length ? { paymentMethod: { in: config.paymentMethods } } : {}),
      // Tags: OR — transação com QUALQUER uma das tags selecionadas (paridade com o
      // predicado client-side do drawer do mês, `row.tags.some(...)`).
      ...(config.tags.length ? { tags: { some: { tagId: { in: config.tags } } } } : {}),
    };

    const txs = await prisma.transaction.findMany({
      where,
      orderBy: { amountCents: "desc" },
      // limit 0 = sem limite (busca todas)
      ...(config.limit > 0 ? { take: config.limit } : {}),
      select: {
        id: true,
        description: true,
        occurredOn: true,
        amountCents: true,
        sectionId: true,
        section: { select: { name: true, countType: true } },
      },
    });

    return txs.map((t) => ({
      id: t.id,
      description: t.description,
      occurredOn: t.occurredOn.toISOString().slice(0, 10),
      amountCents: t.amountCents.toString(),
      sectionId: t.sectionId ?? "",
      sectionName: t.section.name,
      sectionCountType: t.section.countType,
    }));
  },
);

// Dados de todas as instâncias filtered-transactions visíveis, por instanceId.
export async function getFilteredTransactionsMap(
  accountId: string,
  widgets: StoredWidget[],
  monthId: string,
): Promise<Record<string, TxRow[]>> {
  const instances = widgets.filter((w) => w.widgetId === "filtered-transactions" && w.visible);
  const map: Record<string, TxRow[]> = {};
  await Promise.all(
    instances.map(async (inst) => {
      const parsed = filteredTransactionsConfigSchema.safeParse(inst.config);
      const config = parsed.success ? parsed.data : filteredTransactionsConfigSchema.parse({});
      map[inst.instanceId] = await getFilteredTransactions(accountId, monthId, config);
    }),
  );
  return map;
}

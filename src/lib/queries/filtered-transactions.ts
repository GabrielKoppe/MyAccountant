import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/prisma";
import {
  filteredTransactionsConfigSchema,
  type FilteredTransactionsConfig,
} from "@/lib/schemas/widget-config";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { TxRow } from "@/components/dashboards/panels/TopTransactionTable";

// Transações de um mês filtradas pelo config do widget filtered-transactions,
// ordenadas da mais recente para a mais antiga e limitadas por `limit`.
export const getFilteredTransactions = cache(
  async (accountId: string, monthId: string, config: FilteredTransactionsConfig): Promise<TxRow[]> => {
    const where: Prisma.TransactionWhereInput = {
      accountId,
      monthId,
      table: { countInMonth: true },
      ...(config.categories.length ? { categoryId: { in: config.categories } } : {}),
      ...(config.institutions.length ? { institutionId: { in: config.institutions } } : {}),
      ...(config.responsible.length ? { responsibleUserId: { in: config.responsible } } : {}),
      ...(config.pending ? { isPending: true } : {}),
      ...(config.favorite ? { isFavorite: true } : {}),
    };

    const txs = await prisma.transaction.findMany({
      where,
      orderBy: { occurredOn: "desc" },
      take: config.limit,
      select: {
        id: true,
        description: true,
        occurredOn: true,
        amountCents: true,
        section: { select: { name: true, countType: true } },
      },
    });

    return txs.map((t) => ({
      id: t.id,
      description: t.description,
      occurredOn: t.occurredOn.toISOString().slice(0, 10),
      amountCents: t.amountCents.toString(),
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

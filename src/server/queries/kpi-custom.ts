import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/prisma";
import { kpiCustomConfigSchema, type KpiCustomConfig } from "@/lib/schemas/widget-config";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

// Resultado serializado do KPI customizado (BigInt → string).
// `valueCents` = valor monetário do metric (total líquido / entradas / saídas / média);
// `count` = nº de transações (usado pelo metric "count").
export type KpiCustomResult = {
  metric: KpiCustomConfig["metric"];
  valueCents: string;
  count: number;
};

const abs = (v: bigint) => (v < 0n ? -v : v);

// Calcula o valor de um KPI de métrica arbitrária para um conjunto de meses,
// respeitando filtros opcionais (seção/categoria/membro) e o countType das seções.
export const getKpiCustomData = cache(
  async (
    accountId: string,
    monthIds: string[],
    config: KpiCustomConfig,
  ): Promise<KpiCustomResult> => {
    if (monthIds.length === 0) {
      return { metric: config.metric, valueCents: "0", count: 0 };
    }

    const where: Prisma.TransactionWhereInput = {
      accountId,
      monthId: { in: monthIds },
      table: { countInMonth: true },
      ...(config.filterSectionIds?.length ? { sectionId: { in: config.filterSectionIds } } : {}),
      ...(config.filterCategoryIds?.length ? { categoryId: { in: config.filterCategoryIds } } : {}),
      ...(config.filterMemberIds?.length
        ? { responsibleUserId: { in: config.filterMemberIds } }
        : {}),
    };

    const [rows, sections] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["sectionId"],
        where,
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.section.findMany({
        where: { accountId },
        select: { id: true, countType: true },
      }),
    ]);

    const countTypeBySection = new Map(sections.map((s) => [s.id, s.countType]));

    let netCents = 0n;
    let incomeCents = 0n;
    let expenseCents = 0n;
    let count = 0;

    for (const row of rows) {
      const sum = row._sum.amountCents ?? 0n;
      const countType = row.sectionId ? countTypeBySection.get(row.sectionId) : undefined;
      count += row._count._all;

      if (countType === "add") {
        netCents += sum;
        incomeCents += abs(sum);
      } else if (countType === "subtract") {
        netCents -= abs(sum);
        expenseCents += abs(sum);
      } else if (countType === "neutral") {
        netCents += sum;
      }
      // "ignore" não entra no total
    }

    let valueCents: bigint;
    switch (config.metric) {
      case "income":
        valueCents = incomeCents;
        break;
      case "expense":
        valueCents = expenseCents;
        break;
      case "avg":
        valueCents = count > 0 ? netCents / BigInt(count) : 0n;
        break;
      case "count":
        valueCents = 0n;
        break;
      default:
        valueCents = netCents;
    }

    return { metric: config.metric, valueCents: valueCents.toString(), count };
  },
);

// Calcula os dados de todas as instâncias kpi-custom visíveis de um layout,
// indexados por instanceId. Usado pelas páginas RSC (monthly/yearly/month_summary).
export async function getKpiCustomDataMap(
  accountId: string,
  widgets: StoredWidget[],
  monthIds: string[],
): Promise<Record<string, KpiCustomResult>> {
  const instances = widgets.filter((w) => w.widgetId === "kpi-custom" && w.visible);
  const map: Record<string, KpiCustomResult> = {};
  await Promise.all(
    instances.map(async (inst) => {
      const parsed = kpiCustomConfigSchema.safeParse(inst.config);
      const config = parsed.success ? parsed.data : kpiCustomConfigSchema.parse({});
      map[inst.instanceId] = await getKpiCustomData(accountId, monthIds, config);
    }),
  );
  return map;
}

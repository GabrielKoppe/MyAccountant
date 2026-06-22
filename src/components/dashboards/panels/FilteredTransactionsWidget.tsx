"use client";

import { TxTable, type TxRow } from "./TopTransactionTable";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { FilteredTransactionsConfig } from "@/lib/schemas/widget-config";

export type FilterOption = { id: string; name: string };

// Gera um subtitle descritivo com os filtros ativos, resolvendo IDs para nomes.
function buildSubtitle(
  config?: FilteredTransactionsConfig,
  options?: {
    categories?: FilterOption[];
    institutions?: FilterOption[];
    members?: FilterOption[];
  },
): string | undefined {
  if (!config) return undefined;

  const resolve = (ids: string[], list?: FilterOption[]) =>
    ids.map((id) => list?.find((o) => o.id === id)?.name ?? id).join(", ");

  const parts: string[] = [];
  if (config.categories.length) parts.push(resolve(config.categories, options?.categories));
  if (config.institutions.length) parts.push(resolve(config.institutions, options?.institutions));
  if (config.responsible.length) parts.push(resolve(config.responsible, options?.members));
  if (config.pending) parts.push("pendentes");
  if (config.favorite) parts.push("favoritas");

  const limitPart = config.limit === 0 ? "todas" : `top ${config.limit}`;
  return parts.length > 0 ? `${limitPart} · ${parts.join(" · ")}` : limitPart;
}

// Lista compacta de transações de um recorte filtrado (spec 36 §2.3).
export function FilteredTransactionsWidget({
  transactions,
  config,
  options,
}: {
  transactions: TxRow[];
  config?: FilteredTransactionsConfig;
  options?: {
    categories?: FilterOption[];
    institutions?: FilterOption[];
    members?: FilterOption[];
  };
}) {
  const subtitle = buildSubtitle(config, options);
  return (
    <WidgetContainer
      title={m.dashboards.widgets.month_summary["filtered-transactions"]}
      icon={WIDGET_ICONS["filtered-transactions"]}
      subtitle={subtitle}
    >
      <TxTable transactions={transactions} />
    </WidgetContainer>
  );
}

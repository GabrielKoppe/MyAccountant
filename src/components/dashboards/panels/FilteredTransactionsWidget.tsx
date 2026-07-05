"use client";

import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { m } from "@/lib/messages";
import type { FilteredTransactionsConfig } from "@/lib/schemas/widget-config";

import { TxTable, type TxRow } from "./TopTransactionTable";

export type FilterOption = { id: string; name: string };

// Máx. de nomes exibidos por grupo de filtro no subtitle (resto some em "+N").
const MAX_SUBTITLE_NAMES = 3;

export type FilteredTransactionsWidgetOptions = {
  categories?: FilterOption[];
  institutions?: FilterOption[];
  // Parte A / A1: responsáveis por partyId (todas as kinds de persona) — substitui `members`.
  parties?: FilterOption[];
  tags?: FilterOption[];
};

// Gera um subtitle descritivo com os filtros ativos, resolvendo IDs para nomes.
function buildSubtitle(
  config?: FilteredTransactionsConfig,
  options?: FilteredTransactionsWidgetOptions,
): string | undefined {
  if (!config) return undefined;

  const resolve = (ids: string[], list?: FilterOption[]) =>
    ids.map((id) => list?.find((o) => o.id === id)?.name ?? id);

  // Limita cada grupo de filtro aos 3 primeiros nomes, resumindo o restante em "+N",
  // para evitar legendas multi-linha em cards estreitos de widget.
  const capNames = (names: string[]): string => {
    if (names.length <= MAX_SUBTITLE_NAMES) return names.join(", ");
    const overflow = names.length - MAX_SUBTITLE_NAMES;
    return `${names.slice(0, MAX_SUBTITLE_NAMES).join(", ")} +${overflow}`;
  };

  const parts: string[] = [];
  if (config.categories.length)
    parts.push(capNames(resolve(config.categories, options?.categories)));
  if (config.institutions.length)
    parts.push(capNames(resolve(config.institutions, options?.institutions)));
  if (config.responsible.length)
    parts.push(capNames(resolve(config.responsible, options?.parties)));
  if (config.tags.length) parts.push(capNames(resolve(config.tags, options?.tags)));
  if (config.expenseTypes.length)
    parts.push(capNames(config.expenseTypes.map((t) => m.transactions.expenseTypes[t] ?? t)));
  if (config.sources.length)
    parts.push(capNames(config.sources.map((s) => m.transactions.sources[s] ?? s)));
  if (config.paymentMethods.length)
    parts.push(capNames(config.paymentMethods.map((p) => m.transactions.paymentMethods[p] ?? p)));
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
  options?: FilteredTransactionsWidgetOptions;
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

"use client";

// Spec 46 Fase 9 — widget yearly com a evolução do patrimônio líquido ao longo do ano.

import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { NetWorthEvolutionChart } from "@/components/net-worth/NetWorthEvolutionChart";
import { m } from "@/lib/messages";

type Point = {
  year: number;
  month: number;
  assetsCents: string;
  liabilitiesCents: string;
  netCents: string;
};

type Props = {
  series: Point[];
  renderMode?: string;
};

export function NetWorthEvolutionWidget({ series, renderMode = "default" }: Props) {
  return (
    <WidgetContainer
      title={m.dashboards.widgets.yearly["net-worth-evolution"]}
      icon={WIDGET_ICONS["net-worth-evolution"]}
      contentSx={{ overflow: "hidden" }}
    >
      {series.length === 0 ? (
        <EmptyState size="compact" title={m.netWorth.empty} />
      ) : (
        <NetWorthEvolutionChart series={series} height={renderMode === "compact" ? 160 : 260} />
      )}
    </WidgetContainer>
  );
}

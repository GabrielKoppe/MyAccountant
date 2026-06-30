"use client";

import Box from "@mui/material/Box";

import { BarList, type BarItem } from "@/components/dashboards/charts/BarList";
import { PieBreakdown } from "@/components/dashboards/charts/lazy";
import type { PieRenderMode } from "@/components/dashboards/charts/PieBreakdown";
import { BreakdownBarChart } from "@/components/dashboards/charts/lazy";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { CategorySum } from "@/server/queries/dashboards";
import type { CategoryBreakdownConfig } from "@/lib/schemas/widget-config";

type Props = {
  categories: CategorySum[];
  config?: CategoryBreakdownConfig;
  renderMode?: PieRenderMode;
};

export function CategoryBreakdownWidget({ categories, config, renderMode = "default" }: Props) {
  const chartType = config?.chartType ?? "pie";

  const pieItems = categories.map((c) => ({
    name: c.name,
    valueCents: c.totalCents,
  }));

  const barItems: BarItem[] = categories.map((c) => ({
    id: c.categoryId,
    name: c.name,
    valueCents: c.totalCents,
  }));

  return (
    <WidgetContainer
      title={m.dashboards.sections.categoryBreakdown}
      icon={WIDGET_ICONS["category-breakdown"]}
      contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {chartType === "bar" ? (
        <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          <BarList items={barItems} emptyMessage="Nenhuma categoria com transações." />
        </Box>
      ) : chartType === "hbar" ? (
        <BreakdownBarChart
          items={pieItems}
          orientation="hbar"
          renderMode={renderMode}
          emptyMessage="Nenhuma categoria com transações."
        />
      ) : chartType === "vbar" ? (
        <BreakdownBarChart
          items={pieItems}
          orientation="vbar"
          renderMode={renderMode}
          emptyMessage="Nenhuma categoria com transações."
        />
      ) : (
        <PieBreakdown
          items={pieItems}
          renderMode={renderMode}
          emptyMessage="Sem categorias registradas neste mês."
        />
      )}
    </WidgetContainer>
  );
}

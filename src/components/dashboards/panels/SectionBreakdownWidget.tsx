"use client";

import Box from "@mui/material/Box";

import { BarList, type BarItem } from "@/components/dashboards/charts/BarList";
import { PieBreakdown, type PieRenderMode } from "@/components/dashboards/charts/PieBreakdown";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { SectionMeta } from "@/lib/queries/dashboards";
import type { PieChartConfig } from "@/lib/schemas/widget-config";

type Props = {
  sections: SectionMeta[];
  sectionTotals: Record<string, string>;
  config?: PieChartConfig;
  renderMode?: PieRenderMode;
};

export function SectionBreakdownWidget({
  sections,
  sectionTotals,
  config,
  renderMode = "default",
}: Props) {
  const chartType = config?.chartType ?? "pie";
  const filtered = sections.filter((s) => s.countType !== "ignore");

  const pieItems = filtered.map((s) => ({
    name: s.name,
    valueCents: sectionTotals[s.id] ?? "0",
  }));

  const barItems: BarItem[] = filtered
    .map((s) => {
      const raw = BigInt(sectionTotals[s.id] ?? "0");
      return { id: s.id, name: s.name, valueCents: (raw < 0n ? -raw : raw).toString() };
    })
    .filter((item) => BigInt(item.valueCents) > 0n);

  return (
    <WidgetContainer
      title={m.dashboards.sections.sectionBreakdown}
      icon={WIDGET_ICONS["section-breakdown"]}
      contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {chartType === "bar" ? (
        <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          <BarList items={barItems} emptyMessage="Sem seções com valores neste mês." />
        </Box>
      ) : (
        <PieBreakdown
          items={pieItems}
          renderMode={renderMode}
          emptyMessage="Sem seções com valores neste mês."
        />
      )}
    </WidgetContainer>
  );
}

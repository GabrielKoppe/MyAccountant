"use client";

// Spec 38 FEAT-03 — Breakdown de saídas por instituição cadastrada.
// Considera apenas institutionId (FK). institutionText ignorado → "Sem instituição".
// Padrão idêntico ao SectionBreakdownWidget e CategoryBreakdownWidget.

import Box from "@mui/material/Box";

import { BarList, type BarItem } from "@/components/dashboards/charts/BarList";
import { PieBreakdown, type PieRenderMode } from "@/components/dashboards/charts/PieBreakdown";
import { BreakdownBarChart } from "@/components/dashboards/charts/BreakdownBarChart";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { InstitutionBreakdownItem } from "@/lib/queries/dashboards";
import type { PieChartConfig } from "@/lib/schemas/widget-config";

type Props = {
  data: InstitutionBreakdownItem[];
  config?: PieChartConfig;
  renderMode?: PieRenderMode;
};

export function InstitutionBreakdownWidget({ data, config, renderMode = "default" }: Props) {
  const chartType = config?.chartType ?? "pie";

  const nonEmpty = data.filter((d) => BigInt(d.totalCents) > 0n);

  const pieItems = nonEmpty.map((d) => ({
    name: d.name,
    valueCents: d.totalCents,
  }));

  const barItems: BarItem[] = nonEmpty.map((d) => ({
    id: d.institutionId ?? "none",
    name: d.name,
    valueCents: d.totalCents,
  }));

  return (
    <WidgetContainer
      title={m.dashboards.sections.institutionBreakdown}
      icon={WIDGET_ICONS["institution-breakdown"]}
      contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {chartType === "bar" ? (
        <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          <BarList items={barItems} emptyMessage="Sem gastos por instituição neste mês." />
        </Box>
      ) : chartType === "hbar" ? (
        <BreakdownBarChart
          items={pieItems}
          orientation="hbar"
          renderMode={renderMode}
          emptyMessage="Sem gastos por instituição neste mês."
        />
      ) : chartType === "vbar" ? (
        <BreakdownBarChart
          items={pieItems}
          orientation="vbar"
          renderMode={renderMode}
          emptyMessage="Sem gastos por instituição neste mês."
        />
      ) : (
        <PieBreakdown
          items={pieItems}
          renderMode={renderMode}
          emptyMessage="Sem gastos por instituição neste mês."
        />
      )}
    </WidgetContainer>
  );
}

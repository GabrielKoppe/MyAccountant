"use client";

import Box from "@mui/material/Box";

import { BarList, type BarItem } from "@/components/dashboards/charts/BarList";
import { PieBreakdown, type PieRenderMode } from "@/components/dashboards/charts/PieBreakdown";
import { BreakdownBarChart } from "@/components/dashboards/charts/BreakdownBarChart";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import { memberDisplayName } from "@/components/dashboards/_shared/member-display";
import type { MemberBreakdownRow } from "@/lib/queries/member-analytics";
import type { PieChartConfig } from "@/lib/schemas/widget-config";

type Props = {
  rows: MemberBreakdownRow[];
  config?: PieChartConfig;
  renderMode?: PieRenderMode;
};

export function MemberBreakdownWidget({ rows, config, renderMode = "default" }: Props) {
  const chartType = config?.chartType ?? "pie";

  const spenders = rows.filter((r) => BigInt(r.totalCents) > 0n);

  const pieItems = spenders.map((r) => ({
    name: memberDisplayName(r.name, r.isFormerMember),
    valueCents: r.totalCents,
  }));

  const barItems: BarItem[] = spenders.map((r) => ({
    id: r.userId ?? "unassigned",
    name: memberDisplayName(r.name, r.isFormerMember),
    valueCents: r.totalCents,
  }));

  return (
    <WidgetContainer
      title={m.dashboards.sections.memberBreakdown}
      icon={WIDGET_ICONS["member-breakdown"]}
      contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {chartType === "bar" ? (
        <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          <BarList items={barItems} emptyMessage="Sem despesas por membro este mês." />
        </Box>
      ) : chartType === "hbar" ? (
        <BreakdownBarChart
          items={pieItems}
          orientation="hbar"
          renderMode={renderMode}
          emptyMessage="Sem despesas por membro este mês."
        />
      ) : chartType === "vbar" ? (
        <BreakdownBarChart
          items={pieItems}
          orientation="vbar"
          renderMode={renderMode}
          emptyMessage="Sem despesas por membro este mês."
        />
      ) : (
        <PieBreakdown
          items={pieItems}
          renderMode={renderMode}
          emptyMessage="Sem despesas por membro este mês."
        />
      )}
    </WidgetContainer>
  );
}

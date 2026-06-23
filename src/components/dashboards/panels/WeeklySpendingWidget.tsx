"use client";

// Spec 38 FEAT-04 — Gastos por semana do período do mês.
// - compact (2×1): mini-barras sem rótulos — sinal rápido.
// - default (3×2): barras com label de semana; valor em tooltip.
// - expanded (4×3): barras com valores explícitos acima + linha de média.

import Box from "@mui/material/Box";

import { useTheme } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
  Cell,
} from "recharts";

import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import type { WeeklySpendingItem } from "@/server/queries/dashboards";

type Props = {
  data: WeeklySpendingItem[];
  metric?: "expense" | "income" | "both";
  renderMode?: "compact" | "default" | "expanded";
};

const compactPtBR = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

export function WeeklySpendingWidget({ data, metric = "expense", renderMode = "default" }: Props) {
  const theme = useTheme();
  const chartColors = getChartColors(theme.palette.mode as "light" | "dark");
  const tickColor = theme.palette.text.secondary;

  const tooltipStyle = {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    fontSize: 11,
    padding: "4px 8px",
    boxShadow: "none",
  };

  const isCompact = renderMode === "compact";
  const isExpanded = renderMode === "expanded";

  // Preparar dados para recharts
  const chartData = data.map((d) => ({
    name: d.weekLabel,
    expense: Number(BigInt(d.expenseCents)) / 100,
    income: Number(BigInt(d.incomeCents)) / 100,
    // Valor principal para a métrica selecionada
    value:
      metric === "both"
        ? Number(BigInt(d.expenseCents)) / 100
        : metric === "income"
          ? Number(BigInt(d.incomeCents)) / 100
          : Number(BigInt(d.expenseCents)) / 100,
  }));

  // Linha de referência: média da métrica principal
  const mainValues = chartData.map((d) => (metric === "income" ? d.income : d.expense));
  const avg = mainValues.length > 0 ? mainValues.reduce((s, v) => s + v, 0) / mainValues.length : 0;

  if (data.length === 0) {
    return (
      <WidgetContainer
        title={m.dashboards.sections.weekChart}
        icon={WIDGET_ICONS["week-chart"]}
        contentSx={{ overflow: "hidden" }}
      >
        <EmptyState size="compact" title="Sem dados para este período." />
      </WidgetContainer>
    );
  }

  // ── Variante compact (2×1): mini-barras sem texto ──────────────────────────
  if (isCompact) {
    return (
      <WidgetContainer
        title={m.dashboards.sections.weekChart}
        icon={WIDGET_ICONS["week-chart"]}
        contentSx={{ overflow: "hidden" }}
      >
        <Box sx={{ height: "100%", minHeight: 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: theme.palette.action.hover }}
                formatter={(value: unknown, name: unknown) => {
                  const formatted = formatCentsToBrl(BigInt(Math.round((value as number) * 100)));
                  const label =
                    name === "income" || metric === "income"
                      ? "Entradas"
                      : name === "expense" || metric === "expense"
                        ? "Despesas"
                        : String(name);
                  return [formatted, label];
                }}
                labelFormatter={(label: unknown) =>
                  chartData[label as number]?.name ?? String(label)
                }
              />
              {metric === "both" ? (
                <>
                  <Bar dataKey="expense" fill={chartColors[3]} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="income" fill={chartColors[1]} radius={[2, 2, 0, 0]} />
                </>
              ) : (
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={metric === "income" ? chartColors[1] : chartColors[3]} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </WidgetContainer>
    );
  }

  // ── Variante default (3×2): barras + labels de semana + tooltip ───────────
  // ── Variante expanded (4×3): + valores acima + linha de média ─────────────
  return (
    <WidgetContainer
      title={m.dashboards.sections.weekChart}
      icon={WIDGET_ICONS["week-chart"]}
      contentSx={{ overflow: "hidden" }}
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={isExpanded ? 160 : 100}>
        <BarChart
          data={chartData}
          margin={{ top: isExpanded ? 18 : 4, right: 8, bottom: 4, left: 0 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: isCompact ? 9 : 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
          />
          {!isCompact && (
            <YAxis
              hide={!isExpanded}
              tick={{ fontSize: 10, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => compactPtBR.format(v)}
              width={isExpanded ? 40 : 0}
            />
          )}
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: unknown) => {
              const v = value as number;
              console.log("metric value:", metric);
              const label =
                metric === "income" ? "Entradas" : metric === "expense" ? "Despesas" : undefined;
              return [formatCentsToBrl(BigInt(Math.round(v * 100))), label ?? ""] as [
                string,
                string,
              ];
            }}
          />
          {isExpanded && avg > 0 && (
            <ReferenceLine
              y={avg}
              stroke={theme.palette.text.disabled}
              strokeDasharray="4 4"
              label={{
                value: `Média: ${compactPtBR.format(avg)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: tickColor,
              }}
            />
          )}
          {metric === "both" ? (
            <>
              <Bar dataKey="expense" fill={chartColors[3]} radius={[3, 3, 0, 0]} />
              <Bar dataKey="income" fill={chartColors[1]} radius={[3, 3, 0, 0]} />
            </>
          ) : (
            <Bar
              dataKey="value"
              fill={metric === "income" ? chartColors[1] : chartColors[3]}
              radius={[3, 3, 0, 0]}
            >
              {isExpanded && (
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: unknown) => compactPtBR.format(v as number)}
                  style={{ fontSize: 9, fill: tickColor }}
                />
              )}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </WidgetContainer>
  );
}

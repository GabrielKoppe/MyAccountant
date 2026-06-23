"use client";

import { useTheme } from "@mui/material/styles";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type { MemberTrendSeries } from "@/server/queries/member-analytics";

import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";
import {
  buildMemberColorMap,
  memberDisplayName,
} from "@/components/dashboards/_shared/member-display";

type Props = {
  series: MemberTrendSeries[];
  renderMode?: string;
};

type ChartRow = Record<string, string | number>;

const compactPtBR = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "short",
});

function formatReais(reais: number): string {
  return formatCentsToBrl(BigInt(Math.round(reais * 100)));
}

export function MemberTrendChart({ series, renderMode = "default" }: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const tickColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  const isCompact = renderMode === "compact";

  if (series.length === 0) return null;

  const colorMap = buildMemberColorMap(
    series.map((s) => s.seriesId),
    palette,
  );

  const seriesLabels = series.map((s) => memberDisplayName(s.name, s.isFormerMember));

  const monthLabels = series[0]?.points.map((p) => p.monthLabel) ?? [];
  const data: ChartRow[] = monthLabels.map((label, i) => {
    const row: ChartRow = { name: label };
    series.forEach((s, si) => {
      row[seriesLabels[si]] = Number(BigInt(s.points[i]?.totalCents ?? "0")) / 100;
    });
    return row;
  });

  return (
    <WidgetContainer
      title={m.dashboards.sections.memberTrend}
      icon={WIDGET_ICONS["member-trend"]}
      contentSx={{ overflow: "hidden" }}
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={isCompact ? 120 : 160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{
              fill: tickColor,
              fontSize: isCompact ? 9 : 11,
              fontFamily: theme.typography.fontFamily,
            }}
            axisLine={{ stroke: gridColor }}
            tickLine={false}
          />
          <YAxis
            hide={isCompact}
            tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => compactPtBR.format(v)}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: "3 3" }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => <ChartTooltip {...props} formatValue={formatReais} />}
          />
          {!isCompact && (
            <Legend
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: "0.7rem", color: tickColor, paddingTop: 8 }}
            />
          )}
          {series.map((s, si) => (
            <Line
              key={s.seriesId}
              type="monotone"
              dataKey={seriesLabels[si]}
              stroke={colorMap.get(s.seriesId) ?? palette[0]}
              strokeWidth={2}
              dot={{ r: 2, fill: colorMap.get(s.seriesId) ?? palette[0] }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </WidgetContainer>
  );
}

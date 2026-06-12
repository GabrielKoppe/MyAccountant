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
import type { MemberTrendSeries } from "@/lib/queries/member-analytics";

import { ChartTooltip } from "./ChartTooltip";
import { buildMemberColorMap, memberDisplayName } from "./member-display";

type Props = {
  series: MemberTrendSeries[];
};

type ChartRow = Record<string, string | number>;

const compactPtBR = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "short",
});

function formatReais(reais: number): string {
  return formatCentsToBrl(BigInt(Math.round(reais * 100)));
}

export function MemberTrendChart({ series }: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const tickColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  const colorMap = buildMemberColorMap(
    series.map((s) => s.seriesId),
    palette,
  );

  // Nome de exibição por série (com sufixo "(ex-membro)" quando aplicável) — usado como dataKey.
  const seriesLabels = series.map((s) => memberDisplayName(s.name, s.isFormerMember));

  // Eixo X = meses com despesa (todas as séries compartilham os mesmos meses).
  const monthLabels = series[0]?.points.map((p) => p.monthLabel) ?? [];
  const data: ChartRow[] = monthLabels.map((label, i) => {
    const row: ChartRow = { name: label };
    series.forEach((s, si) => {
      row[seriesLabels[si]] = Number(BigInt(s.points[i]?.totalCents ?? "0")) / 100;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
          axisLine={{ stroke: gridColor }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => compactPtBR.format(v)}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: gridColor, strokeWidth: 1, strokeDasharray: "3 3" }}
          content={(props: any) => <ChartTooltip {...props} formatValue={formatReais} />}
        />
        <Legend
          iconSize={8}
          iconType="circle"
          wrapperStyle={{ fontSize: "0.7rem", color: tickColor, paddingTop: 8 }}
        />
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
  );
}

"use client";

import { useTheme } from "@mui/material/styles";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { ChartTooltip } from "./ChartTooltip";
import type { MonthSummary, SectionMeta } from "@/lib/queries/dashboards";

type Props = {
  months: MonthSummary[];
  sections: SectionMeta[];
};

type ChartRow = Record<string, string | number>;

function centsToReais(centsStr: string): number {
  return Number(BigInt(centsStr)) / 100;
}

function formatReais(reais: number): string {
  return formatCentsToBrl(BigInt(Math.round(reais * 100)));
}

const compactPtBR = new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" });

export function YearlyLineChart({ months, sections }: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const tickColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;
  const totalLineColor = theme.palette.text.secondary;

  const visibleSections = sections.filter((s) => s.countType !== "ignore");

  const data: ChartRow[] = months.map((m) => {
    const row: ChartRow = { name: m.label, Total: centsToReais(m.total) };
    for (const s of visibleSections) {
      row[s.name] = centsToReais(m.sectionTotals[s.id] ?? "0");
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
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
          content={(props: any) => (
            <ChartTooltip {...props} formatValue={formatReais} />
          )}
        />

        <Legend
          iconSize={8}
          iconType="circle"
          wrapperStyle={{
            fontSize: "0.7rem",
            color: tickColor,
            paddingTop: 8,
          }}
        />

        <ReferenceLine y={0} stroke={gridColor} />

        {/* Linha Total — tracejada, usa cor secundária para não competir com seções */}
        <Line
          type="monotone"
          dataKey="Total"
          stroke={totalLineColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={{ r: 2, fill: totalLineColor }}
          activeDot={{ r: 4 }}
        />

        {visibleSections.map((s, i) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.name}
            stroke={palette[i % palette.length]}
            strokeWidth={2}
            dot={{ r: 2, fill: palette[i % palette.length] }}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

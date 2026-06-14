"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import {
  BarChart,
  Bar,
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
import { ChartTooltip, PieLegend } from "@/components/dashboards/_shared/ChartTooltip";
import type { MonthSummary, SectionMeta } from "@/lib/queries/dashboards";

type Props = {
  months: MonthSummary[];
  sections: SectionMeta[];
  monthPagePrefix?: string;
};

type ChartRow = Record<string, string | number>;

function centsToReais(centsStr: string): number {
  return Number(BigInt(centsStr)) / 100;
}

function formatReais(reais: number): string {
  return formatCentsToBrl(BigInt(Math.round(reais * 100)));
}

const compactPtBR = new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" });

export function MonthlyBarChart({ months, sections, monthPagePrefix }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const tickColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  const visibleSections = sections.filter((s) => s.countType !== "ignore");

  const data: ChartRow[] = months.map((m) => {
    const row: ChartRow = { name: m.label, monthId: m.id };
    for (const s of visibleSections) {
      const raw = centsToReais(m.sectionTotals[s.id] ?? "0");
      row[s.name] = s.countType === "subtract" ? -Math.abs(raw) : raw;
    }
    return row;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(chartState: any) {
    if (!monthPagePrefix || !chartState?.activePayload?.[0]) return;
    const row = chartState.activePayload[0].payload as ChartRow;
    router.push(`${monthPagePrefix}${row.monthId}`);
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        onClick={handleClick}
        style={{ cursor: monthPagePrefix ? "pointer" : "default" }}
        barCategoryGap="30%"
      >
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
          cursor={{ fill: theme.palette.action.hover }}
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

        {visibleSections.map((s, i) => (
          <Bar
            key={s.id}
            dataKey={s.name}
            fill={palette[i % palette.length]}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";
import { useTheme } from "@mui/material/styles";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getChartColors } from "@/lib/design-tokens";
import { formatCentsToBrl } from "@/lib/money";
import { formatMonthLabel } from "@/lib/dates";
import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";
import { m } from "@/lib/messages";

type Point = { year: number; month: number; assetsCents: string; liabilitiesCents: string; netCents: string };
type Props = { series: Point[]; height?: number };

const toReais = (c: string) => Number(BigInt(c)) / 100;

export function NetWorthEvolutionChart({ series, height = 260 }: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const gridColor = theme.palette.divider;
  const tickColor = theme.palette.text.secondary;
  const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" });

  const data = series.map((p) => ({
    label: formatMonthLabel(p.year, p.month),
    net: toReais(p.netCents),
    assets: toReais(p.assetsCents),
    liabilities: toReais(p.liabilitiesCents),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: gridColor }}
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }} />
        <YAxis width={56} axisLine={false} tickLine={false}
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
          tickFormatter={(v: number) => compact.format(v)} />
        <Tooltip cursor={{ stroke: gridColor, strokeDasharray: "3 3" }}
          content={(props: any) =>
            props.active && props.payload?.length ? (
              <ChartTooltip active label={props.label}
                payload={props.payload.map((p: any) => ({ name: p.name, color: p.stroke, value: p.value }))}
                formatValue={(v: number) => formatCentsToBrl(BigInt(Math.round(v * 100)))} />
            ) : null
          } />
        <Legend iconSize={8} iconType="plainline"
          wrapperStyle={{ fontSize: "0.7rem", color: tickColor, paddingTop: 8 }} />
        <Line type="monotone" dataKey="assets" name={m.netWorth.assets} stroke={theme.palette.success.main} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="liabilities" name={m.netWorth.liabilities} stroke={theme.palette.error.main} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="net" name={m.netWorth.title} stroke={palette[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

"use client";

import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { ChartTooltip, PieLegend } from "@/components/dashboards/_shared/ChartTooltip";
import type { SectionMeta } from "@/server/queries/dashboards";

type Props = {
  sections: SectionMeta[];
  sectionTotals: Record<string, string>;
};

export function SectionPieChart({ sections, sectionTotals }: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");

  const data = sections
    .filter((s) => s.countType !== "ignore")
    .map((s) => ({
      name: s.name,
      value: Math.abs(Number(BigInt(sectionTotals[s.id] ?? "0")) / 100),
      raw: sectionTotals[s.id] ?? "0",
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sem seções com valores neste mês.
      </Typography>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="46%"
          outerRadius={88}
          innerRadius={52}
          dataKey="value"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>

        <Tooltip
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null;
            const entry = props.payload[0] as any;
            const raw = (entry?.payload?.raw as string) ?? "0";
            return (
              <ChartTooltip
                active
                payload={[{ name: entry.name, value: entry.value, color: entry.fill }]}
                formatValue={() => formatCentsToBrl(BigInt(raw))}
                hideName={false}
              />
            );
          }}
        />

        <Legend
          iconSize={0}
          content={(props: any) => <PieLegend {...props} />}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

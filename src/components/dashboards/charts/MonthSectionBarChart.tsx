"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SectionCountType } from "@prisma/client";
import { formatCentsToBrl } from "@/lib/money";
import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";

type Props = {
  sections: { id: string; name: string; countType: SectionCountType }[];
  sectionTotals: Record<string, string>;
  accountId: string;
  monthId: string;
};

export function MonthSectionBarChart({ sections, sectionTotals, accountId, monthId }: Props) {
  const router = useRouter();
  const theme = useTheme();

  // error.main = danger.main do design system (terracota), info.main = accent.primary (índigo)
  const countTypeColors: Record<SectionCountType, string> = {
    add:      theme.palette.success.main,
    subtract: theme.palette.error.main,
    neutral:  theme.palette.info.main,
    ignore:   theme.palette.text.disabled,
  };

  const data = sections
    .filter((s) => s.countType !== "ignore")
    .map((s) => ({
      id: s.id,
      name: s.name,
      countType: s.countType,
      value: Math.abs(Number(BigInt(sectionTotals[s.id] ?? "0")) / 100),
      raw: sectionTotals[s.id] ?? "0",
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) return null;

  // Altura compacta: 36px por barra, máximo 160px
  const chartHeight = Math.min(160, Math.max(64, data.length * 36));

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null;
            const entry = props.payload[0];
            return (
              <ChartTooltip
                active
                payload={[{
                  name: entry.payload.name,
                  value: entry.value,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  color: countTypeColors[entry.payload.countType as SectionCountType],
                }]}
                formatValue={() => formatCentsToBrl(BigInt(entry.payload.raw))}
                hideName={false}
              />
            );
          }}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          // onClick no Bar recebe diretamente o objeto de dados da barra — mais confiável
          // que o onClick do BarChart que depende de activePayload (undefined fora das barras)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(data: any) => {
            if (data?.id) router.push(`/${accountId}/months/${monthId}?tab=${data.id}`);
          }}
          style={{ cursor: "pointer" }}
        >
          {data.map((entry) => (
            <Cell key={entry.id} fill={countTypeColors[entry.countType]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

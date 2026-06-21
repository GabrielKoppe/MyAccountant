"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { ChartTooltip, PieLegend } from "@/components/dashboards/_shared/ChartTooltip";

export type PieItem = {
  name: string;
  /** Valor em centavos (string para suportar BigInt serializado). Aceita negativos. */
  valueCents: string;
};

export type PieRenderMode = "compact" | "default" | "full";

type Props = {
  items: PieItem[];
  renderMode?: PieRenderMode;
  emptyMessage?: string;
};

/**
 * Gráfico de rosca (donut) genérico, responsivo.
 * Adapta tamanho e legenda conforme `renderMode`:
 * - compact: sem legenda, pie centralizado e grande.
 * - default: pie levemente acima para caber legenda embaixo.
 * - full: pie centralizado com mais raio, legenda embaixo.
 */

const PIE_SCHEMA: Record<
  PieRenderMode,
  {
    cy: string;
    outerRadius: string;
    innerRadius: string;
    showLegend: boolean;
    label?: boolean | Record<string, unknown>;
  }
> = {
  compact: { cy: "50%", outerRadius: "92%", innerRadius: "56%", showLegend: false, label: false },
  default: { cy: "43%", outerRadius: "82%", innerRadius: "50%", showLegend: true, label: false },
  full: {
    cy: "50%",
    outerRadius: "88%",
    innerRadius: "54%",
    showLegend: true,
    label: {
      position: "outside",
      formatter: (value: number) => `R$ ${value}`,
    },
  },
};

export function PieBreakdown({
  items,
  renderMode = "default",
  emptyMessage = "Sem dados para exibir.",
}: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");

  // Garante fallback seguro se um renderMode não reconhecido for passado
  const schema = PIE_SCHEMA[renderMode] ?? PIE_SCHEMA.default;

  const pieData = items
    .map((item) => ({
      name: item.name,
      value: Math.abs(Number(BigInt(item.valueCents)) / 100),
      raw: item.valueCents,
    }))
    .filter((d) => d.value > 0);

  if (pieData.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy={schema.cy}
            outerRadius={schema.outerRadius}
            innerRadius={schema.innerRadius}
            dataKey="value"
            paddingAngle={2}
            strokeWidth={0}
            label={schema.label}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>

          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => {
              if (!props.active || !props.payload?.length) return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

          {schema.showLegend && (
            <Legend
              iconSize={0}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={(props: any) => <PieLegend {...props} />}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}

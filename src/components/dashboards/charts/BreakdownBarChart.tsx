"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";

export type BreakdownItem = {
  name: string;
  /** Valor em centavos (string). Aceita negativos. */
  valueCents: string;
};

type Props = {
  items: BreakdownItem[];
  /**
   * "hbar" = barras horizontais (categorias no eixo Y)
   * "vbar" = colunas verticais (categorias no eixo X)
   */
  orientation: "hbar" | "vbar";
  renderMode?: string;
  emptyMessage?: string;
};

const compactPtBR = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "short",
});

function formatValue(cents: bigint): string {
  return formatCentsToBrl(cents);
}

function formatCompact(cents: bigint): string {
  return compactPtBR.format(Number(cents) / 100);
}

/**
 * Gráfico de barras (horizontal ou vertical) genérico e responsivo.
 * Adapta rótulos e margens conforme `renderMode`:
 * - compact: sem rótulos nos itens, eixos minimalistas
 * - default: rótulos compactos (ex: "1,2K")
 * - full:    rótulos completos (ex: "R$ 1.234,56")
 */
export function BreakdownBarChart({
  items,
  orientation,
  renderMode = "default",
  emptyMessage = "Sem dados para exibir.",
}: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const tickColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  const isCompact = renderMode === "compact";
  const isFull = renderMode === "full";
  const showLabel = !isCompact; // compact: sem label nos itens

  const data = items.map((item) => {
    const abs = Math.abs(Number(BigInt(item.valueCents)) / 100);
    return { name: item.name, value: abs, raw: item.valueCents };
  });

  const tooltipFormatter = (v: unknown) => formatValue(BigInt(Math.round((v as number) * 100)));

  // ── Barras horizontais ───────────────────────────────────────────────────
  if (orientation === "hbar") {
    // Largura do eixo Y proporcional ao comprimento dos nomes
    const maxNameLen = Math.max(...items.map((i) => i.name.length));
    const yAxisWidth = isCompact ? 60 : Math.min(120, Math.max(70, maxNameLen * 6));

    return (
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{
              top: 4,
              right: isFull ? 80 : showLabel ? 60 : 12,
              bottom: 4,
              left: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis
              type="number"
              hide={isCompact}
              tick={{ fill: tickColor, fontSize: 10, fontFamily: theme.typography.fontFamily }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => compactPtBR.format(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={yAxisWidth}
              tick={{
                fill: tickColor,
                fontSize: isCompact ? 10 : 11,
                fontFamily: theme.typography.fontFamily,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => (isCompact && v.length > 10 ? v.slice(0, 9) + "…" : v)}
            />
            <Tooltip
              cursor={{ fill: theme.palette.action.hover }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={(props: any) => (
                <ChartTooltip {...props} formatValue={(v) => tooltipFormatter(v)} />
              )}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
              {showLabel && (
                <LabelList
                  dataKey="value"
                  position="right"
                  style={{
                    fill: tickColor,
                    fontSize: 10,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                  }}
                  formatter={(v: unknown) =>
                    isFull
                      ? formatCompact(BigInt(Math.round((v as number) * 100)))
                      : compactPtBR.format(v as number)
                  }
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  }

  // ── Colunas verticais ────────────────────────────────────────────────────
  // Ângulo de rotação das labels do eixo X conforme renderMode
  const xAngle = isCompact ? -45 : items.length > 6 ? -35 : 0;
  const xTickHeight = isCompact ? 48 : items.length > 6 ? 36 : 20;

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: showLabel ? 24 : 8,
            right: 8,
            bottom: xTickHeight,
            left: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{
              fill: tickColor,
              fontSize: 10,
              fontFamily: theme.typography.fontFamily,
              textAnchor: xAngle !== 0 ? "end" : "middle",
            }}
            axisLine={false}
            tickLine={false}
            angle={xAngle}
            interval={0}
            tickFormatter={(v: string) =>
              isCompact && v.length > 8
                ? v.slice(0, 7) + "…"
                : v.length > 12
                  ? v.slice(0, 11) + "…"
                  : v
            }
          />
          <YAxis
            hide={isCompact}
            tick={{ fill: tickColor, fontSize: 10, fontFamily: theme.typography.fontFamily }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => compactPtBR.format(v)}
            width={44}
          />
          <Tooltip
            cursor={{ fill: theme.palette.action.hover }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => (
              <ChartTooltip {...props} formatValue={(v) => tooltipFormatter(v)} />
            )}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
            {showLabel && (
              <LabelList
                dataKey="value"
                position="top"
                style={{
                  fill: tickColor,
                  fontSize: 9,
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                }}
                formatter={(v: unknown) =>
                  isFull
                    ? formatCompact(BigInt(Math.round((v as number) * 100)))
                    : compactPtBR.format(v as number)
                }
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

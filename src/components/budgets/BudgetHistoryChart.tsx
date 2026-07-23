"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { getColors, motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { BudgetHistoryEntry, BudgetMonthStatus } from "@/server/queries/budgets";

import { BUDGET_STATUS_LABEL } from "./budget-status";

type Props = {
  history: BudgetHistoryEntry[];
  /** Valor-alvo do orçamento (centavos, string — BigInt serializado). */
  amountCents: string;
  height?: number;
};

const toReais = (cents: string) => Number(BigInt(cents)) / 100;

// Rótulo curto do eixo X ("jun/26" — ano com 2 dígitos): a faixa cobre até ~12 meses
// (`getBudgetsConfigWithHistory` limita a 12), então o rótulo cheio de
// `formatMonthLabel` (ano com 4 dígitos, usado no glide-path de metas) ficaria apertado
// demais lado a lado. `date-fns` com locale ptBR já devolve "jun" minúsculo — sem
// precisar da capitalização manual que `formatMonthLabel` faz.
function shortMonthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), "MMM/yy", { locale: ptBR });
}

/**
 * Gráfico de barras do histórico mensal de UM orçamento (spec 47 §5.9 fix wave) —
 * uma barra por mês existente da account, colorida pelo STATUS daquele mês
 * (`ok`/`alert`/`exceeded`, mesmos limiares do Budget), com `ReferenceLine` no
 * valor-alvo. Espelha o estilo de `GoalGlidePathChart` (recharts, tokens de tema via
 * `theme.palette`/`getColors`, `ChartTooltip`, zero hex, reveal respeitando
 * `prefers-reduced-motion`) — mas em barras: cada mês do orçamento é um valor
 * discreto (gasto do mês), não uma série acumulada como o glide-path de metas.
 *
 * Todo o dado já vem pronto em `BudgetHistoryEntry` (`getBudgetsConfigWithHistory`) —
 * nenhum cálculo de gasto/status é duplicado aqui, só formatação de apresentação.
 *
 * Consumir sempre via `dynamic(..., { ssr: false })` — recharts é browser-only (ver
 * `BudgetDetailDialog.tsx`).
 */
export function BudgetHistoryChart({ history, amountCents, height = 220 }: Props) {
  const theme = useTheme();
  // Reveal das barras no mount é o único uso de motion aqui — nunca re-anima por
  // interação (mesmo racional de GoalGlidePathChart, skill mui-motion).
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const gridColor = theme.palette.divider;
  const tickColor = theme.palette.text.secondary;
  // `text.tertiary` é token custom do tema (ColorTokens), não da Palette padrão do MUI —
  // vem via `getColors(mode)`, mesmo caminho de GoalGlidePathChart/DailyHeatmap.
  const targetLineColor = getColors(theme.palette.mode as "light" | "dark").text.tertiary;
  const compactFormatter = new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    compactDisplay: "short",
  });

  // Cor da barra por status — sem hex, só `theme.palette.*` (CLAUDE.md §5.11).
  const STATUS_COLOR: Record<BudgetMonthStatus, string> = {
    ok: theme.palette.success.main,
    alert: theme.palette.warning.main,
    exceeded: theme.palette.danger.main,
  };

  if (history.length === 0) {
    return (
      <Box sx={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <EmptyState size="compact" title={m.budgets.history.empty} />
      </Box>
    );
  }

  const target = toReais(amountCents);
  const data = history.map((entry) => ({
    key: entry.monthId,
    label: shortMonthLabel(entry.year, entry.month),
    spent: toReais(entry.spentCents),
    percent: entry.percent,
    status: entry.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: gridColor }}
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
        />
        <YAxis
          width={56}
          axisLine={false}
          tickLine={false}
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
          tickFormatter={(v: number) => compactFormatter.format(v)}
        />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null;
            const point = props.payload[0]?.payload as (typeof data)[number] | undefined;
            if (!point) return null;
            const statusColor = STATUS_COLOR[point.status];
            return (
              <ChartTooltip
                active
                label={point.label}
                payload={[
                  { name: m.budgets.progress.spent, value: point.spent, color: statusColor },
                  {
                    name: m.budgets.history.percentOfLimit(point.percent),
                    color: tickColor,
                  },
                  { name: BUDGET_STATUS_LABEL[point.status], color: statusColor },
                ]}
                formatValue={(v: number) => formatCentsToBrl(BigInt(Math.round(v * 100)))}
              />
            );
          }}
        />
        <ReferenceLine
          y={target}
          stroke={targetLineColor}
          strokeDasharray="4 4"
          label={{
            value: m.budgets.history.limitLabel,
            position: "insideTopRight",
            fill: tickColor,
            fontSize: 11,
          }}
        />
        <Bar
          dataKey="spent"
          name={m.budgets.progress.spent}
          radius={[3, 3, 0, 0]}
          maxBarSize={40}
          isAnimationActive={!reduceMotion}
          animationDuration={motion.duration.slow}
          animationEasing="ease-out"
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={STATUS_COLOR[entry.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

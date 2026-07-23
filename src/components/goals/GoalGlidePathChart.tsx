"use client";

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";
import { formatMonthLabel } from "@/lib/dates";
import { getChartColors, getColors, motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";

type Point = {
  year: number;
  month: number;
  cumulativeCents: string;
  /** null quando a meta não tem deadline OU o ponto está além do prazo (§4.4, goal-service.ts). */
  idealCents: string | null;
  targetCents: string;
};
type Props = { series: Point[]; height?: number };

const toReais = (c: string) => Number(BigInt(c)) / 100;

/**
 * Glide-path da meta (spec 47 §5.4/§4.4) — espelha `NetWorthEvolutionChart` (recharts,
 * `getChartColors(mode)`, `ChartTooltip`, zero hex, `Number(BigInt(str))/100` só aqui no
 * render): área+linha SÓLIDA (`palette[0]`) = acúmulo real (`cumulativeCents`); linha
 * TRACEJADA (`palette[1]`, `strokeDasharray="5 4"`) = ritmo ideal (`idealCents` — só
 * plota quando a meta tem deadline; `connectNulls={false}` faz o trecho sem prazo, ou
 * além dele, virar um buraco em vez de reta); `ReferenceLine` horizontal
 * (`theme.palette.text.tertiary` — U5 fix wave: `divider` tem contraste baixo demais
 * pra uma linha de referência, fica só no `CartesianGrid`) = alvo constante (`targetCents`).
 * Reveal no mount anima (`isAnimationActive`/`animationDuration`/`animationEasing`,
 * skill mui-motion), respeitando `prefers-reduced-motion` (U6).
 *
 * Consumir sempre via `dynamic(..., { ssr: false })` — recharts é browser-only (ver
 * `GoalDetailDrawer.tsx`). Testar em light e dark (§5.8).
 */
export function GoalGlidePathChart({ series, height = 260 }: Props) {
  const theme = useTheme();
  // U6 (fix wave, skill mui-motion): respeita prefers-reduced-motion — reveal do
  // chart no mount é o único uso de motion aqui, nunca re-anima por interação.
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const gridColor = theme.palette.divider;
  // U5 (fix wave): a ReferenceLine do alvo usava `divider` (~1.2:1, quase invisível
  // sobre o fundo) — stroke próprio com contraste ≥3:1. `divider` fica só no grid.
  // `text.tertiary` é token custom do tema (ColorTokens), não da Palette padrão do
  // MUI — vem via `getColors(mode)`, mesmo caminho de DailyHeatmap.tsx.
  const targetLineColor = getColors(theme.palette.mode as "light" | "dark").text.tertiary;
  const tickColor = theme.palette.text.secondary;
  const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" });

  const data = series.map((p) => ({
    label: formatMonthLabel(p.year, p.month),
    actual: toReais(p.cumulativeCents),
    ideal: p.idealCents !== null ? toReais(p.idealCents) : null,
    target: toReais(p.targetCents),
  }));

  // ReferenceLine exige 1 valor único — a série já é constante (§4.4); usa o último
  // ponto para não quebrar se a série vier vazia (meta recém-criada sem glide-path).
  const targetValue = data.length > 0 ? data[data.length - 1].target : 0;

  // Meta sem deadline (ou 100% além do prazo): idealCents é null em TODOS os pontos —
  // omite a linha (e a entrada de legenda) em vez de plotar uma série invisível (§4.4/§5.4).
  const hasIdeal = data.some((p) => p.ideal !== null);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
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
          tickFormatter={(v: number) => compact.format(v)}
        />
        <Tooltip
          cursor={{ stroke: gridColor, strokeDasharray: "3 3" }}
          content={(props: any) =>
            props.active && props.payload?.length ? (
              <ChartTooltip
                active
                label={props.label}
                payload={props.payload
                  .filter((p: any) => p.value != null)
                  .map((p: any) => ({ name: p.name, color: p.stroke ?? p.fill, value: p.value }))}
                formatValue={(v: number) => formatCentsToBrl(BigInt(Math.round(v * 100)))}
              />
            ) : null
          }
        />
        <Legend
          iconSize={8}
          iconType="plainline"
          wrapperStyle={{ fontSize: "0.7rem", color: tickColor, paddingTop: 8 }}
        />
        <ReferenceLine
          y={targetValue}
          stroke={targetLineColor}
          strokeDasharray="4 4"
          label={{
            value: m.goals.glidePath.target,
            position: "insideTopRight",
            fill: tickColor,
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="actual"
          name={m.goals.glidePath.actual}
          stroke={palette[0]}
          fill={palette[0]}
          fillOpacity={0.16}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={!reduceMotion}
          animationDuration={motion.duration.slow}
          animationEasing="ease-out"
        />
        {hasIdeal && (
          <Line
            type="monotone"
            dataKey="ideal"
            name={m.goals.glidePath.ideal}
            stroke={palette[1]}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={!reduceMotion}
            animationDuration={motion.duration.slow}
            animationEasing="ease-out"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

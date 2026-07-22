"use client";

import { useTheme } from "@mui/material/styles";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";
import { getChartColors } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { Scenario } from "@/lib/schemas/forecast";
import type { CashflowForecast } from "@/server/queries/cashflow-forecast";

export type ForecastPoint = CashflowForecast["points"][number];
type RenderMode = "compact" | "default" | "expanded";
export type ScenarioBalanceKey =
  | "optimisticBalanceCents"
  | "realisticBalanceCents"
  | "conservativeBalanceCents";

type Props = {
  forecast: CashflowForecast;
  scenario: Scenario;
  renderMode?: RenderMode;
  height?: number;
};

// Mapa estável — evita recriar o objeto (e a checagem por ternário) a cada render.
export const SCENARIO_BALANCE_KEY: Record<Scenario, ScenarioBalanceKey> = {
  optimistic: "optimisticBalanceCents",
  realistic: "realisticBalanceCents",
  conservative: "conservativeBalanceCents",
};

export type RunwayTrough = {
  runwayYearMonth: string | null;
  troughYearMonth: string;
  troughBalanceCents: string;
};

/**
 * Deriva runway (1º mês projetado com saldo negativo) e vale (mínimo saldo
 * projetado, seed no primeiro ponto projetado) para o `balanceKey` do cenário
 * exibido. `composeForecast` (service) computa `runwayYearMonth`/
 * `troughYearMonth`/`troughBalanceCents` só em cima do cenário REALISTA —
 * então ao trocar de cenário no client (toggle da página / `scenarioDefault`
 * do widget) esses stats ficavam "presos" no realista e podiam contradizer a
 * linha exibida (ex: otimista sem ruptura, mas badge "fica negativo em Out").
 * Espelha a mesma lógica do service, só que sobre `points[balanceKey]` —
 * client-side, apenas para exibição; não persiste nem substitui o cálculo do
 * servidor.
 *
 * Nota: por `CashflowForecastChart.tsx` importar `recharts` no top-level,
 * consumidores fora deste arquivo (`ForecastManager.tsx`,
 * `CashflowForecastWidget.tsx`) NÃO importam esta função — duplicam-na
 * localmente para não furar o code-splitting (`charts/lazy.tsx`: recharts
 * sempre via dynamic import). Se a lógica mudar aqui, replicar lá.
 */
export function deriveRunwayTrough(
  points: readonly ForecastPoint[],
  balanceKey: ScenarioBalanceKey,
): RunwayTrough {
  const projectedPoints = points.filter((p) => p.isProjected);

  let runwayYearMonth: string | null = null;
  let troughYearMonth = "";
  let troughBalanceCents = 0n;

  projectedPoints.forEach((p, i) => {
    const balance = BigInt(p[balanceKey]);
    if (runwayYearMonth === null && balance < 0n) runwayYearMonth = p.yearMonth;
    if (i === 0 || balance < troughBalanceCents) {
      troughBalanceCents = balance;
      troughYearMonth = p.yearMonth;
    }
  });

  return { runwayYearMonth, troughYearMonth, troughBalanceCents: troughBalanceCents.toString() };
}

const toReais = (cents: string) => Number(BigInt(cents)) / 100;
const toBrlSigned = (reais: number) =>
  formatCentsToBrl(BigInt(Math.round(reais * 100)), { sign: true });

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "short",
});

/**
 * ComposedChart da projeção de fluxo de caixa (spec 48).
 *
 * `forecast.points` = exatamente 1 ponto-âncora (`isProjected:false`, saldo
 * acumulado de hoje) seguido de N pontos projetados. Não há histórico
 * multi-ponto — por isso o visual é: ponto sólido na âncora ("hoje") + UMA
 * linha tracejada de projeção cobrindo todos os pontos (âncora → horizonte) +
 * banda translúcida de incerteza (conservador↔otimista).
 */
export function CashflowForecastChart({
  forecast,
  scenario,
  renderMode = "default",
  height = 300,
}: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const gridColor = theme.palette.divider;
  const tickColor = theme.palette.text.secondary;
  const seriesColor = palette[0];
  const showExtras = renderMode !== "compact";

  const balanceKey = SCENARIO_BALANCE_KEY[scenario];
  const anchor = forecast.points.find((p) => !p.isProjected);

  const data = forecast.points.map((p) => ({
    label: p.label,
    balance: toReais(p[balanceKey]),
    band: [toReais(p.conservativeBalanceCents), toReais(p.optimisticBalanceCents)] as [
      number,
      number,
    ],
    raw: p,
  }));

  // Runway/vale recalculados sobre o `balanceKey` do cenário EXIBIDO — o
  // servidor só computa esses dois stats em cima do realista (ver
  // `deriveRunwayTrough`), então usar `forecast.runwayYearMonth`/
  // `troughYearMonth` direto aqui faria o marcador contradizer a linha
  // plotada ao trocar de cenário.
  const { runwayYearMonth, troughYearMonth, troughBalanceCents } = deriveRunwayTrough(
    forecast.points,
    balanceKey,
  );
  const runwayLabel = runwayYearMonth
    ? forecast.points.find((p) => p.yearMonth === runwayYearMonth)?.label
    : undefined;
  const troughLabel = forecast.points.find((p) => p.yearMonth === troughYearMonth)?.label;

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
          tickFormatter={(v: number) => compactFormatter.format(v)}
        />
        <ReferenceLine y={0} stroke={gridColor} />

        {/* Cone de incerteza — banda conservador↔otimista. Area com dataKey
            retornando [min,max] é detectada nativamente pelo recharts como
            "range area" (Area.js: Array.isArray(rawValue) => isRange=true).
            Stroke sutil (25% opacidade) dá contorno à banda — só o fill
            (12%) lia fraco demais no modo claro. */}
        <Area
          type="monotone"
          dataKey="band"
          stroke={seriesColor}
          strokeOpacity={0.25}
          fill={seriesColor}
          fillOpacity={0.14}
          isAnimationActive={false}
          legendType="none"
        />

        {/* Projeção — tracejada, da âncora (hoje) até o fim do horizonte */}
        <Line
          type="monotone"
          dataKey="balance"
          name={m.cashflowForecast.scenarios[scenario]}
          stroke={seriesColor}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />

        {/* Âncora — ponto sólido marcando o saldo acumulado de hoje */}
        {anchor && (
          <ReferenceDot
            x={anchor.label}
            y={toReais(anchor[balanceKey])}
            r={4}
            fill={seriesColor}
            stroke="none"
          />
        )}

        {showExtras && runwayLabel && (
          <ReferenceLine
            x={runwayLabel}
            stroke={theme.palette.error.main}
            strokeDasharray="4 4"
            label={{
              value: m.cashflowForecast.runwayLabel,
              position: "insideTopRight",
              fill: theme.palette.error.main,
              fontSize: 10,
            }}
          />
        )}

        {showExtras && troughLabel && (
          <ReferenceDot
            x={troughLabel}
            y={toReais(troughBalanceCents)}
            r={4}
            fill={theme.palette.warning.main}
            stroke="none"
          />
        )}

        {showExtras && (
          <Legend
            iconSize={8}
            iconType="plainline"
            wrapperStyle={{ fontSize: "0.7rem", color: tickColor, paddingTop: 8 }}
          />
        )}

        <Tooltip
          cursor={{ stroke: gridColor, strokeDasharray: "3 3" }}
          content={(props: any) => {
            if (!props.active || !props.payload?.length) return null;
            const p = props.payload[0]?.payload?.raw as ForecastPoint | undefined;
            if (!p) return null;
            const resultIsNegative = BigInt(p.monthResultCents) < 0n;
            const balanceIsNegative = BigInt(p[balanceKey]) < 0n;
            return (
              <ChartTooltip
                active
                label={`${p.label}${p.isProjected ? ` · ${m.cashflowForecast.projected}` : ""}`}
                payload={[
                  {
                    name: `${m.cashflowForecast.recurringIn} · ${m.cashflowForecast.known}`,
                    color: theme.palette.success.main,
                    value: toReais(p.recurringInflowCents),
                  },
                  {
                    name: `${m.cashflowForecast.recurringOut} · ${m.cashflowForecast.known}`,
                    color: theme.palette.error.main,
                    value: -toReais(p.recurringOutflowCents),
                  },
                  {
                    name: `${m.cashflowForecast.installments} · ${m.cashflowForecast.known}`,
                    color: theme.palette.error.main,
                    value: -toReais(p.installmentsOutflowCents),
                  },
                  {
                    name: `${m.cashflowForecast.estimated} · ${m.cashflowForecast.estimate} · ${m.cashflowForecast.estimateWindow(forecast.effectiveWindow)}`,
                    color: theme.palette.text.secondary,
                    value: toReais(p.estimatedCents),
                  },
                  {
                    name: m.cashflowForecast.monthResult,
                    color: resultIsNegative ? theme.palette.error.main : theme.palette.success.main,
                    value: toReais(p.monthResultCents),
                  },
                  {
                    name: m.cashflowForecast.balance,
                    color: balanceIsNegative ? theme.palette.error.main : seriesColor,
                    value: toReais(p[balanceKey]),
                  },
                ]}
                formatValue={toBrlSigned}
              />
            );
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

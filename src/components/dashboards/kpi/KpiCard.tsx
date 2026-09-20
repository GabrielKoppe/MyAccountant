"use client";

import { Fragment } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import type { SvgIconComponent } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import {
  LineChart,
  Line,
  XAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { getChartColors } from "@/lib/design-tokens";
import type { SparklinePoint } from "@/server/queries/dashboards";
import { Divider } from "@mui/material";

type DeltaMode = "prevMonth" | "prevYear" | "avg3m" | "none";

type CardColor = "default" | "success" | "warning" | "error" | "info";

/** Item de breakdown — lista compacta exibida abaixo do valor do KPI. */
export type KpiBreakdownItem = {
  label: string;
  value: string;
  /** Token semântico MUI para o ponto colorido. Ex: "error.main", "success.main". Omitir para sem ponto. */
  dotColor?: string;
};

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  icon?: SvgIconComponent;
  color?: CardColor;
  sparkline?: SparklinePoint[];
  currentCents?: string;
  prevCents?: string | null;
  deltaMode?: DeltaMode;
  deltaPp?: { current: number; prev: number | null };
  /** "wide" quando o widget está na variante larga (2×1). */
  renderMode?: string;
  /**
   * Lista compacta de sub-itens exibida abaixo do valor.
   * Substituí o `subtitle` quando há múltiplos itens (ex: "Saídas 132 · Entradas 45").
   * Cada item: ponto colorido opcional + label + valor em mono.
   */
  breakdown?: KpiBreakdownItem[];
  /**
   * Gauge semicircular ocupando o espaço inferior do card, no lugar da sparkline.
   * `percent`: 0–100. A cor é derivada automaticamente do campo `color` do card.
   * Incompatível com `sparkline` — `gauge` tem prioridade.
   */
  gauge?: { percent: number };
};

// MUI token aliases — success.50 não existe no v6, usar success.light (= subtle no nosso tema)
const BG_TOKEN: Record<CardColor, string> = {
  default: "background.paper",
  success: "success.light",
  warning: "warning.light",
  error: "error.light",
  info: "info.light",
};

const TEXT_TOKEN: Record<CardColor, string> = {
  default: "text.primary",
  success: "success.main",
  warning: "warning.main",
  error: "error.main",
  info: "info.main",
};

// Índice na paleta de gráficos do design system por tipo de card
const PALETTE_IDX: Record<CardColor, number> = {
  default: 0, // índigo
  success: 1, // verde-musgo
  warning: 2, // mostarda
  error: 3, // terracota
  info: 4, // azul-cinza
};

function computeDelta(
  currentCents: string | undefined,
  prevCents: string | null | undefined,
): { pct: number; label: string; positive: boolean } | null {
  if (!currentCents || !prevCents) return null;
  const cur = BigInt(currentCents);
  const prev = BigInt(prevCents);
  if (prev === 0n) return null;
  const pct = ((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100;
  const positive = pct > 0;
  const label = `${positive ? "+" : ""}${pct.toFixed(1)}%`;
  return { pct, label, positive };
}

// Delta em pontos percentuais para KPIs que já são uma porcentagem.
function computePpDelta(
  deltaPp: { current: number; prev: number | null } | undefined,
): { pct: number; label: string; positive: boolean } | null {
  if (!deltaPp || deltaPp.prev == null) return null;
  const diff = Math.round(deltaPp.current - deltaPp.prev);
  return { pct: diff, label: `${diff >= 0 ? "+" : ""}${diff} pp`, positive: diff > 0 };
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "default",
  sparkline,
  currentCents,
  prevCents,
  deltaMode = "none",
  deltaPp,
  renderMode = "default",
  breakdown,
  gauge,
}: Props) {
  const theme = useTheme();
  const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");
  const lineColor = chartPalette[PALETTE_IDX[color] ?? 0];
  const textToken = TEXT_TOKEN[color];
  const bgToken = BG_TOKEN[color];
  const delta = computeDelta(currentCents, prevCents) ?? computePpDelta(deltaPp);
  const hasSpark = !gauge && sparkline && sparkline.length > 1;
  const hasGauge = !!gauge;
  const isWide = renderMode === "wide";
  const tickColor = theme.palette.text.secondary;

  const tooltipStyle = {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    fontSize: 11,
    padding: "4px 8px",
    color: theme.palette.text.primary,
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: "none",
    width: "100%",
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: bgToken,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 80,
        borderColor: "border.subtle",
        borderRadius: "12px",
      }}
    >
      {/* ── Cabeçalho: título (esq) + ícone (dir) ── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          mb: 0.5,
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: "text.tertiary", fontSize: "0.65rem", lineHeight: 1.4 }}
          noWrap
        >
          {title}
        </Typography>
        {Icon && <Icon sx={{ color: textToken, fontSize: 16, opacity: 0.55, flexShrink: 0 }} />}
      </Box>

      {/* ── Valor + delta (sempre igual nos dois modos) ── */}
      <Typography
        variant="h5"
        sx={{
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontWeight: 500,
          color: textToken,
          lineHeight: 1.2,
          mb: 0.25,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </Typography>

      {subtitle && (
        <Typography variant="caption" color="text.tertiary" noWrap>
          {subtitle}
        </Typography>
      )}

      {delta && deltaMode !== "none" && (
        <Tooltip
          title={
            deltaMode === "prevMonth"
              ? "vs mês anterior"
              : deltaMode === "prevYear"
                ? "vs mesmo mês ano anterior"
                : "vs média 3 meses"
          }
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {delta.positive ? (
              <TrendingUpIcon sx={{ fontSize: 14, color: "success.main" }} />
            ) : delta.pct === 0 ? (
              <TrendingFlatIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 14, color: "error.main" }} />
            )}
            <Typography
              variant="caption"
              color={
                delta.positive ? "success.main" : delta.pct === 0 ? "text.disabled" : "error.main"
              }
              sx={{ fontSize: 11 }}
            >
              {delta.label}
            </Typography>
          </Box>
        </Tooltip>
      )}

      {/* ── Breakdown: lista compacta de sub-itens (ex: saídas · entradas) ──
           Só exibido em modo `wide` para manter o card compacto em default.
      */}
      {isWide && breakdown && breakdown.length > 0 && (
        <Box
          sx={{
            mt: 0.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.25,
            maxHeight: 48,
            overflow: "hidden",
          }}
        >
          {breakdown.map((item, i) => (
            <Fragment key={i}>
              <Divider sx={{ borderColor: "border.subtle" }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                {item.dotColor && (
                  <Box
                    sx={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      bgcolor: item.dotColor,
                      flexShrink: 0,
                    }}
                  />
                )}
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    fontSize: "0.63rem",
                    color: "text.secondary",
                    flex: 1,
                    minWidth: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: "0.64rem",
                    fontWeight: 600,
                    flexShrink: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {item.value}
                </Typography>
              </Box>
            </Fragment>
          ))}
          <Divider sx={{ my: 0.25, borderColor: "border.subtle" }} />
        </Box>
      )}

      {/* ── Gauge: arco SVG com gradiente contínuo verde→amarelo→vermelho e agulha ──
           Preenche todo o espaço flex disponível abaixo do valor.
           O viewBox 200×110 escala com a largura do card mantendo proporções.
           linearGradient local ao SVG — sem conflito entre instâncias.
      */}
      {hasGauge &&
        (() => {
          const pct = Math.min(Math.max(gauge!.percent, 0), 100);
          // Ângulo: 0% → 180° (esquerda), 100% → 0° (direita)
          const needleAngleDeg = 180 - (pct / 100) * 180;
          const needleRad = (needleAngleDeg * Math.PI) / 180;
          const svgCx = 100,
            svgCy = 105; // pivot no centro inferior do viewBox
          const needleLen = 51;
          const nx = svgCx + needleLen * Math.cos(needleRad);
          const ny = svgCy - needleLen * Math.sin(needleRad);

          return (
            <Box
              sx={{
                flex: 1,
                mt: 0.5,
                minHeight: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-end",
                mb: 1.5,
              }}
            >
              <svg
                height={isWide ? 140 : 110}
                viewBox="0 0 200 110"
                style={{ display: "block", overflow: "visible" }}
              >
                <defs>
                  {/* Gradiente linear da esquerda (verde/saudável) para direita (vermelho/crítico) */}
                  <linearGradient id="kpi-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={theme.palette.success.main} />
                    <stop offset="42%" stopColor={theme.palette.warning.main} />
                    <stop offset="100%" stopColor={theme.palette.error.main} />
                  </linearGradient>
                </defs>

                {/* Trilho de fundo */}
                <path
                  d="M 49 105 A 51 51 0 0 1 151 105"
                  stroke={theme.palette.action.selected}
                  strokeWidth="13"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Arco com gradiente */}
                <path
                  d="M 49 105 A 51 51 0 0 1 151 105"
                  stroke="url(#kpi-gauge-grad)"
                  strokeWidth="13"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Sombra do pivot */}
                <circle
                  cx={svgCx}
                  cy={svgCy}
                  r={10}
                  fill={theme.palette.background.paper}
                  opacity={0.5}
                />
                {/* Agulha */}
                <line
                  x1={svgCx}
                  y1={svgCy}
                  x2={nx}
                  y2={ny}
                  stroke={theme.palette.text.primary}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Pivot */}
                <circle cx={svgCx} cy={svgCy} r={5} fill={theme.palette.text.primary} />
              </svg>
            </Box>
          );
        })()}

      {/* ── Sparkline ──
           default: decorativo (32px, sem eixos)
           wide:    informativo (58px + XAxis com rótulos de mês)
      */}
      {hasSpark && (
        <Box sx={{ flex: 1, mt: -1.75, minHeight: isWide ? 88 : 32 }}>
          <ResponsiveContainer width="100%" height={isWide ? 88 : 32}>
            <LineChart
              data={sparkline}
              margin={{
                top: 2,
                right: 4,
                bottom: isWide ? 18 : 2,
                left: 4,
              }}
            >
              {isWide && (
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 9, fontFamily: theme.typography.fontFamily }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
              )}
              {isWide && <ReferenceLine y={0} stroke={theme.palette.divider} />}
              <RechartsTooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: theme.palette.text.primary }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [
                  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    Number(v),
                  ),
                  "",
                ]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any) => String(label)}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={isWide ? 2 : 1.5}
                dot={false}
                activeDot={{ r: isWide ? 4 : 3, fill: lineColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}

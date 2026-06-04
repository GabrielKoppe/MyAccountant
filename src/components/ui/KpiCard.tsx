"use client";

import { Box, Card, CardContent, Skeleton, Stack, Typography, useTheme } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { ReactNode } from "react";

import { layout } from "@/lib/design-tokens";
import { formatCentsToBrl } from "@/lib/money";

export interface KpiDelta {
  /** Variacao percentual (ex: 12.5 para +12.5%) */
  value: number;
  /** Texto do periodo de comparacao (ex: "vs mes anterior") */
  period: string;
  /** Como interpretar o sinal:
   *  - "positive-is-good" (default): aumento = verde, queda = vermelho
   *  - "negative-is-good": aumento = vermelho, queda = verde (ex: gastos)
   *  - "neutral": sempre cinza
   */
  intent?: "positive-is-good" | "negative-is-good" | "neutral";
}

export interface KpiCardProps {
  /** Rotulo curto (uppercase pequeno) */
  label: string;
  /** Valor principal. Se bigint, formatado como BRL automaticamente. */
  value: bigint | string | number;
  /** Variacao opcional vs periodo anterior */
  delta?: KpiDelta;
  /** Dados para sparkline (ultimos N pontos) */
  sparkline?: number[];
  /** Cor da sparkline. Default: accent.primary */
  sparklineColor?: string;
  /** Icone decorativo no canto superior direito */
  icon?: ReactNode;
  /** Tooltip/helper text discreto abaixo do valor */
  hint?: string;
  /** Esconde estado, mostrando skeleton */
  loading?: boolean;
}

/**
 * Card de KPI padronizado para dashboards.
 *
 * Layout:
 *   LABEL                          [icon]
 *   42.350,00       ↑ +12% vs mes anterior
 *   [sparkline ........]
 *   [hint opcional]
 */
export function KpiCard({
  label,
  value,
  delta,
  sparkline,
  sparklineColor,
  icon,
  hint,
  loading = false,
}: KpiCardProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={layout.stack}>
            <Skeleton variant="text" width="40%" height={16} />
            <Skeleton variant="text" width="60%" height={48} />
            <Skeleton variant="rectangular" height={32} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const formattedValue = typeof value === "bigint" ? formatCentsToBrl(value) : value.toString();

  const lineColor = sparklineColor ?? theme.palette.primary.main;

  return (
    <Card>
      <CardContent>
        <Stack spacing={layout.stack}>
          {/* Header: label + icon */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="overline">{label}</Typography>
            {icon && <Box sx={{ color: "text.tertiary", display: "flex" }}>{icon}</Box>}
          </Stack>

          {/* Valor principal */}
          <Typography variant="kpi" component="div">
            {formattedValue}
          </Typography>

          {/* Delta */}
          {delta && <KpiDeltaIndicator {...delta} />}

          {/* Sparkline */}
          {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} color={lineColor} />}

          {/* Hint */}
          {hint && (
            <Typography variant="caption" sx={{ color: "text.tertiary" }}>
              {hint}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-componentes internos
// ============================================================================

function KpiDeltaIndicator({ value, period, intent = "positive-is-good" }: KpiDelta) {
  const isZero = Math.abs(value) < 0.01;
  const isPositive = value > 0;

  let color: string;
  if (isZero || intent === "neutral") {
    color = "text.tertiary";
  } else if (intent === "positive-is-good") {
    color = isPositive ? "success.main" : "danger.main";
  } else {
    color = isPositive ? "danger.main" : "success.main";
  }

  const Icon = isZero ? null : isPositive ? ArrowUpwardIcon : ArrowDownwardIcon;

  return (
    <Stack direction="row" spacing={layout.micro} alignItems="center" sx={{ color }}>
      {Icon && <Icon sx={{ fontSize: 14 }} />}
      <Typography variant="body2" sx={{ fontWeight: 500, color: "inherit" }}>
        {isZero ? "Sem variação" : `${isPositive ? "+" : ""}${value.toFixed(1)}%`}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.tertiary" }}>
        {period}
      </Typography>
    </Stack>
  );
}

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

function Sparkline({ data, color, width = 200, height = 40 }: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Box sx={{ width: "100%", height: height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    </Box>
  );
}

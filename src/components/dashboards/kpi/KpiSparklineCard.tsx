"use client";

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
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { getChartColors } from "@/lib/design-tokens";
import type { SparklinePoint } from "@/lib/queries/dashboards";

type DeltaMode = "prevMonth" | "prevYear" | "avg3m" | "none";

type CardColor = "default" | "success" | "warning" | "error" | "info";

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
};

// MUI token aliases — success.50 não existe no v6, usar success.light (= subtle no nosso tema)
const BG_TOKEN: Record<CardColor, string> = {
  default: "background.paper",
  success: "success.light",
  warning: "warning.light",
  error:   "error.light",
  info:    "info.light",
};

const TEXT_TOKEN: Record<CardColor, string> = {
  default: "text.primary",
  success: "success.main",
  warning: "warning.main",
  error:   "error.main",
  info:    "info.main",
};

// Índice na paleta de gráficos do design system por tipo de card
const PALETTE_IDX: Record<CardColor, number> = {
  default: 0,  // índigo
  success: 1,  // verde-musgo
  warning: 2,  // mostarda
  error:   3,  // terracota
  info:    4,  // azul-cinza
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

export function KpiSparklineCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "default",
  sparkline,
  currentCents,
  prevCents,
  deltaMode = "none",
}: Props) {
  const theme = useTheme();
  const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");
  const lineColor = chartPalette[PALETTE_IDX[color] ?? 0];
  const textToken = TEXT_TOKEN[color];
  const bgToken = BG_TOKEN[color];
  const delta = computeDelta(currentCents, prevCents);
  const hasSpark = sparkline && sparkline.length > 1;

  const tooltipStyle = {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    fontSize: 11,
    padding: "4px 8px",
    color: theme.palette.text.primary,
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: "none",
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
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 0.5 }}>
        <Typography
          variant="overline"
          sx={{ color: "text.tertiary", fontSize: "0.65rem", lineHeight: 1.4 }}
          noWrap
        >
          {title}
        </Typography>
        {Icon && (
          <Icon sx={{ color: textToken, fontSize: 16, opacity: 0.55, flexShrink: 0 }} />
        )}
      </Box>

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

      {hasSpark && (
        <Box sx={{ flex: 1, mt: 1.5, minHeight: 32 }}>
          <ResponsiveContainer width="100%" height={32}>
            <LineChart data={sparkline} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <RechartsTooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: theme.palette.text.primary }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [
                  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)),
                  "",
                ]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any) => String(label)}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: lineColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: "auto", pt: 0.5 }}>
            {delta.positive ? (
              <TrendingUpIcon sx={{ fontSize: 14, color: "success.main" }} />
            ) : delta.pct === 0 ? (
              <TrendingFlatIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 14, color: "error.main" }} />
            )}
            <Typography
              variant="caption"
              color={delta.positive ? "success.main" : delta.pct === 0 ? "text.disabled" : "error.main"}
              sx={{ fontSize: 11 }}
            >
              {delta.label}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Paper>
  );
}

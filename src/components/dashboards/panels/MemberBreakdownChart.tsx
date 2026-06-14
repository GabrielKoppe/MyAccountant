"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { MemberBreakdownRow } from "@/lib/queries/member-analytics";

import { ChartTooltip, PieLegend } from "@/components/dashboards/_shared/ChartTooltip";
import { buildMemberColorMap, memberDisplayName } from "@/components/dashboards/_shared/member-display";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import BarChartIcon from "@mui/icons-material/BarChart";

export type MemberBreakdownView = "donut" | "bars";

type Props = {
  rows: MemberBreakdownRow[];
  view: {
    type: MemberBreakdownView;
    onChange: (view: MemberBreakdownView) => void;
  };
};

function seriesKey(row: MemberBreakdownRow): string {
  return row.userId ?? "unassigned";
}

export function MemberBreakdownChart({ rows, view }: Props) {
  const theme = useTheme();

  const palette = getChartColors(theme.palette.mode as "light" | "dark");

  // Apenas responsáveis com despesa entram no gráfico (ordenados desc pela query).
  const spenders = useMemo(() => rows.filter((r) => BigInt(r.totalCents) > 0n), [rows]);

  // Mapa estável de cores por id de série — compartilhado entre donut, barras e dots do ranking.
  const colorMap = useMemo(
    () => buildMemberColorMap(spenders.map(seriesKey), palette),
    [spenders, palette],
  );

  const chartData = useMemo(
    () =>
      spenders.map((r) => ({
        key: seriesKey(r),
        name: memberDisplayName(r.name, r.isFormerMember),
        value: Number(BigInt(r.totalCents)) / 100,
        raw: r.totalCents,
      })),
    [spenders],
  );

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
        gap: 3,
        alignItems: "start",
        px: 0.5,
      }}
    >
      {/* Ranking — todos os membros (zerados ao final) */}
      <Box>
        <Typography variant="overline" sx={{ color: "text.tertiary", display: "block", mb: 1 }}>
          {m.dashboards.members.whoSpentMost}
        </Typography>
        <Stack spacing={1}>
          {rows.map((row) => {
            const key = seriesKey(row);
            const hasSpend = BigInt(row.totalCents) > 0n;
            const dotColor = hasSpend
              ? (colorMap.get(key) ?? theme.palette.text.disabled)
              : theme.palette.text.disabled;
            return (
              <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: dotColor,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {memberDisplayName(row.name, row.isFormerMember)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.tertiary" }} noWrap>
                    {row.topCategoryName ?? m.dashboards.members.emptyTopCategory}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography
                    component="div"
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                      color: hasSpend ? "text.primary" : "text.disabled",
                    }}
                  >
                    {formatCentsToBrl(BigInt(row.totalCents))}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {row.sharePercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Gráfico (apenas quem gastou) */}
      <Box>
        {view.type === "donut" ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="46%"
                outerRadius={88}
                innerRadius={52}
                dataKey="value"
                paddingAngle={2}
                strokeWidth={0}
              >
                {chartData.map((d) => (
                  <Cell key={d.key} fill={colorMap.get(d.key) ?? palette[0]} />
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
              <Legend iconSize={0} content={(props: any) => <PieLegend {...props} />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 44)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: theme.palette.action.hover }}
                content={(props: any) => {
                  if (!props.active || !props.payload?.length) return null;
                  const entry = props.payload[0] as any;
                  const raw = (entry?.payload?.raw as string) ?? "0";
                  return (
                    <ChartTooltip
                      active
                      payload={[
                        { name: entry.payload.name, value: entry.value, color: entry.fill },
                      ]}
                      formatValue={() => formatCentsToBrl(BigInt(raw))}
                      hideName={false}
                    />
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {chartData.map((d) => (
                  <Cell key={d.key} fill={colorMap.get(d.key) ?? palette[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
}

export function MemberBreakdownChartSecondary({
  view,
  onChange,
}: {
  view: MemberBreakdownView;
  onChange: (view: MemberBreakdownView) => void;
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={view}
      onChange={(_, v: MemberBreakdownView | null) => v && onChange(v)}
    >
      <ToggleButton value="donut" aria-label={m.dashboards.members.viewDonut}>
        <Tooltip title={m.dashboards.members.viewDonut}>
          <DonutLargeIcon sx={{ fontSize: 16 }} />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="bars" aria-label={m.dashboards.members.viewBars}>
        <Tooltip title={m.dashboards.members.viewBars}>
          <BarChartIcon sx={{ fontSize: 16 }} />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

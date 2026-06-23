"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import NorthIcon from "@mui/icons-material/North";
import SouthIcon from "@mui/icons-material/South";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { MonthSummary, SectionMeta } from "@/server/queries/dashboards";

type Props = {
  months: MonthSummary[];
  sections: SectionMeta[];
  /** Prefixo de rota para navegar ao dashboard mensal: `/${accountId}/dashboards/monthly/` */
  monthDashboardPrefix: string;
  renderMode?: string;
};

type ChartRow = Record<string, string | number>;

const COMPACT_PAGE_SIZE = 3;

function centsToReais(centsStr: string): number {
  return Number(BigInt(centsStr)) / 100;
}
function formatReais(reais: number): string {
  return formatCentsToBrl(BigInt(Math.round(reais * 100)));
}
const compactPtBR = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "short",
});

export function MonthlyBarChart({
  months,
  sections,
  monthDashboardPrefix,
  renderMode = "default",
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const tickColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  const [compactPage, setCompactPage] = useState(0);

  const visibleSections = sections.filter((s) => s.countType !== "ignore");

  function makeRows(source: MonthSummary[]): ChartRow[] {
    return source.map((mo) => {
      const row: ChartRow = { name: mo.label, monthId: mo.id };
      for (const s of visibleSections) {
        const raw = centsToReais(mo.sectionTotals[s.id] ?? "0");
        row[s.name] = s.countType === "subtract" ? -Math.abs(raw) : raw;
      }
      return row;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleBarClick(chartState: any) {
    if (!chartState?.activePayload?.[0]) return;
    const row = chartState.activePayload[0].payload as ChartRow;
    if (row.monthId) router.push(`${monthDashboardPrefix}${row.monthId}`);
  }

  const bars = visibleSections.map((s, i) => (
    <Bar key={s.id} dataKey={s.name} fill={palette[i % palette.length]} radius={[3, 3, 0, 0]} />
  ));

  // ── Compact (3×2): paginação de 3 meses + setas ──────────────────────────────
  if (renderMode === "compact") {
    const totalPages = Math.ceil(months.length / COMPACT_PAGE_SIZE);
    const pageMonths = months.slice(
      compactPage * COMPACT_PAGE_SIZE,
      compactPage * COMPACT_PAGE_SIZE + COMPACT_PAGE_SIZE,
    );
    const data = makeRows(pageMonths);

    return (
      <WidgetContainer
        title={m.dashboards.sections.monthlyChart}
        icon={WIDGET_ICONS["monthly-bar-chart"]}
        contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden", pt: 0.5 }}
        secondary={
          totalPages > 1 ? (
            <Stack direction="row" alignItems="center" gap={0.25}>
              <Typography variant="caption" color="text.tertiary" sx={{ fontSize: "0.65rem" }}>
                {compactPage + 1}/{totalPages}
              </Typography>
              <IconButton
                size="small"
                disabled={compactPage === 0}
                onClick={() => setCompactPage((p) => p - 1)}
                sx={{ p: 0.25 }}
              >
                <ChevronLeftIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <IconButton
                size="small"
                disabled={compactPage >= totalPages - 1}
                onClick={() => setCompactPage((p) => p + 1)}
                sx={{ p: 0.25 }}
              >
                <ChevronRightIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
          ) : undefined
        }
      >
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              onClick={handleBarClick}
              style={{ cursor: "pointer" }}
              barCategoryGap="25%"
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: tickColor, fontSize: 10, fontFamily: theme.typography.fontFamily }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <ReferenceLine y={0} stroke={gridColor} />
              <Tooltip
                cursor={{ fill: theme.palette.action.hover }}
                content={(props: any) => <ChartTooltip {...props} formatValue={formatReais} />}
              />
              {bars}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </WidgetContainer>
    );
  }

  // ── Expanded (6×3): barras + cards ricos por mês abaixo ─────────────────────
  if (renderMode === "expanded") {
    const data = makeRows(months);

    const addSections = visibleSections.filter((s) => s.countType === "add");
    const subtractSections = visibleSections.filter((s) => s.countType === "subtract");

    const monthDetails = months.map((mo, idx) => {
      const income = addSections.reduce((sum, s) => {
        const raw = BigInt(mo.sectionTotals[s.id] ?? "0");
        return sum + (raw < 0n ? -raw : raw);
      }, 0n);
      const expense = subtractSections.reduce((sum, s) => {
        const raw = BigInt(mo.sectionTotals[s.id] ?? "0");
        return sum + (raw < 0n ? -raw : raw);
      }, 0n);
      const total = BigInt(mo.total);

      // Variação vs mês anterior (em %)
      let deltaPct: number | null = null;
      if (idx > 0) {
        const prevTotal = BigInt(months[idx - 1].total);
        if (prevTotal !== 0n) {
          deltaPct = Math.round(Number((total - prevTotal) * 100n) / Math.abs(Number(prevTotal)));
        }
      }

      // Comprometimento: despesa como % da receita
      const commitRatio =
        income > 0n ? Math.min(100, Math.round(Number((expense * 100n) / income))) : 0;
      const commitColor: "success" | "warning" | "error" =
        commitRatio >= 100 ? "error" : commitRatio >= 80 ? "warning" : "success";

      return {
        id: mo.id,
        label: mo.label,
        total,
        income,
        expense,
        deltaPct,
        commitRatio,
        commitColor,
        href: `${monthDashboardPrefix}${mo.id}`,
      };
    });

    return (
      <WidgetContainer
        title={m.dashboards.sections.monthlyChart}
        icon={WIDGET_ICONS["monthly-bar-chart"]}
        secondary={
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
            Clique em uma barra ou mês para abrir
          </Typography>
        }
        contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden", gap: 1 }}
      >
        {/* Gráfico — protagonista (~58% da altura) */}
        <Box sx={{ flex: "0 0 58%", minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <BarChart
              data={data}
              onClick={handleBarClick}
              style={{ cursor: "pointer" }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => compactPtBR.format(v)}
                width={52}
              />
              <Tooltip
                cursor={{ fill: theme.palette.action.hover }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={(props: any) => <ChartTooltip {...props} formatValue={formatReais} />}
              />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: "0.7rem", color: tickColor, paddingTop: 4 }}
              />
              <ReferenceLine y={0} stroke={gridColor} />
              {bars}
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Divider />

        {/* Cards por mês — occupam toda a largura, dividida igualmente */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", px: 1, py: 0.75 }}>
          <Stack
            direction="row"
            sx={{
              height: "100%",
              gap: 2,
              alignItems: "stretch",
            }}
          >
            {monthDetails.map((mo) => (
              <Box
                key={mo.id}
                component="button"
                onClick={() => router.push(mo.href)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 0.5,
                  p: 2,
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  transition: "background-color 0.15s, border-color 0.15s",
                  "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: 0,
                  }}
                >
                  {/* Mês */}
                  <Typography
                    variant="caption"
                    color="text.tertiary"
                    sx={{
                      fontSize: "0.75rem",
                      lineHeight: 1,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {mo.label}
                  </Typography>

                  {/* Saldo total */}
                  <Typography
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      color: mo.total >= 0n ? "success.main" : "danger.main",
                      lineHeight: 1.1,
                    }}
                  >
                    {formatCentsToBrl(mo.total)}
                  </Typography>
                </Box>
                <Box>
                  {/* Receita + Despesa */}
                  <Stack gap={0.2}>
                    <Typography sx={{ fontSize: "0.65rem", color: "text.tertiary", lineHeight: 1 }}>
                      Receita e Despesa
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={0.35}>
                      <NorthIcon sx={{ fontSize: 9, color: "success.main", flexShrink: 0 }} />
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          color: "success.main",
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                          lineHeight: 1,
                        }}
                      >
                        {compactPtBR.format(Number(mo.income) / 100)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={0.35}>
                      <SouthIcon sx={{ fontSize: 9, color: "error.main", flexShrink: 0 }} />
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          color: "error.main",
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                          lineHeight: 1,
                        }}
                      >
                        {compactPtBR.format(Number(mo.expense) / 100)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Box>
                  {/* Barra de comprometimento (despesa / receita) */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                      <Typography
                        sx={{ fontSize: "0.65rem", color: "text.tertiary", lineHeight: 1 }}
                      >
                        Comprometido
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.65rem",
                          color: `${mo.commitColor}.main`,
                          lineHeight: 1,
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                        }}
                      >
                        {mo.commitRatio}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={mo.commitRatio}
                      color={mo.commitColor}
                      sx={{ height: 3, borderRadius: 2 }}
                    />
                  </Box>

                  {/* Variação vs mês anterior */}
                  {mo.deltaPct !== null && (
                    <Stack direction="row" alignItems="center" gap={0.25}>
                      {mo.deltaPct >= 0 ? (
                        <NorthIcon
                          sx={{
                            fontSize: 9,
                            color: mo.deltaPct > 0 ? "success.main" : "text.tertiary",
                          }}
                        />
                      ) : (
                        <SouthIcon sx={{ fontSize: 9, color: "error.main" }} />
                      )}
                      <Typography
                        sx={{
                          fontSize: "0.62rem",
                          color:
                            mo.deltaPct > 0
                              ? "success.main"
                              : mo.deltaPct < 0
                                ? "error.main"
                                : "text.tertiary",
                          lineHeight: 1,
                        }}
                      >
                        {mo.deltaPct > 0 ? "+" : ""}
                        {mo.deltaPct}% vs ant.
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </WidgetContainer>
    );
  }

  // ── Default (6×2) ────────────────────────────────────────────────────────────
  const data = makeRows(months);
  return (
    <WidgetContainer
      title={m.dashboards.sections.monthlyChart}
      icon={WIDGET_ICONS["monthly-bar-chart"]}
      secondary={
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          Clique em uma barra para abrir o mês
        </Typography>
      }
      contentSx={{ overflow: "hidden" }}
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={140}>
        <BarChart
          data={data}
          onClick={handleBarClick}
          style={{ cursor: "pointer" }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
            axisLine={{ stroke: gridColor }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => compactPtBR.format(v)}
            width={52}
          />
          <Tooltip
            cursor={{ fill: theme.palette.action.hover }}
            content={(props: any) => <ChartTooltip {...props} formatValue={formatReais} />}
          />
          <Legend
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: "0.7rem", color: tickColor, paddingTop: 8 }}
          />
          <ReferenceLine y={0} stroke={gridColor} />
          {bars}
        </BarChart>
      </ResponsiveContainer>
    </WidgetContainer>
  );
}
